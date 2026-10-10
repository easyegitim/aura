"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BEARD_PRESETS } from "@/content/beard-presets";
import { COLOR_PRESETS } from "@/content/color-presets";
import { HAIR_PRESETS } from "@/content/hair-presets";
import { getPreset } from "@/content/presets";
import type { Preset } from "@/content/types";
import { SelfieCamera, type CaptureResult } from "@/components/camera/SelfieCamera";
import { FeedbackButtons } from "@/components/report/FeedbackButtons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { track } from "@/lib/analytics";
import { ApiClientError, postJson } from "@/lib/api/client";
import { blobToBase64 } from "@/lib/api/analysisClient";
import { VisionClient } from "@/lib/face/client";
import { cropForServer, landmarksToCrop } from "@/lib/face/crop";
import { getSessionSelfie, setSessionSelfie } from "@/lib/face/sessionStore";
import { stampAiLabel } from "@/lib/tryon/composite";

type Props = {
  consentVersion: string;
  hasConsent: boolean;
  recommended: string[];
  quota: { used: number; limit: number; nextAt: string | null };
  initialPreset?: string;
  presentation: "male" | "female" | "unspecified";
};

type Kind = "hair" | "beard" | "color" | "recommended";
type Stage = "gallery" | "camera" | "generating" | "result";

const CROP_SIZE = 1024;
/** Süre ölçümü (olay işleyicilerinde; modül düzeyinde tanımlı). */
const nowMs = () => performance.now();
const epochNow = () => Date.now();

/** /dene (F11): stil galerisi → (rıza) → selfie bellekte → POST /api/tryon → worker kompoziti → önce/sonra. */
export function TryonScreen({ consentVersion, hasConsent, recommended, quota, initialPreset, presentation }: Props) {
  const t = useTranslations("tryon");
  const tc = useTranslations("common");
  const [consent, setConsent] = useState(hasConsent);
  const [tab, setTab] = useState<Kind>(recommended.length ? "recommended" : "hair");
  const [stage, setStage] = useState<Stage>("gallery");
  const [pending, setPending] = useState<Preset | null>(initialPreset ? (getPreset(initialPreset) ?? null) : null);
  const [used, setUsed] = useState(quota.used);
  const [result, setResult] = useState<{ eventId: string; preset: Preset; beforeUrl: string; afterUrl: string; afterBitmap: ImageBitmap } | null>(null);
  const [slider, setSlider] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);

  const list = useMemo(() => {
    const byPres = (p: Preset) => !p.presentation || presentation === "unspecified" || p.presentation.includes(presentation);
    if (tab === "recommended") return recommended.map(getPreset).filter((p): p is Preset => Boolean(p));
    if (tab === "hair") return HAIR_PRESETS.filter(byPres);
    if (tab === "beard") return BEARD_PRESETS;
    return COLOR_PRESETS;
  }, [tab, recommended, presentation]);

  async function giveConsent() {
    try {
      await postJson("/api/consents", { type: "tryon_generation", granted: true, textVersion: consentVersion });
      track("consent_updated", { type: "tryon_generation", granted: true });
      setConsent(true);
    } catch {
      toast.error(t("consentError"));
    }
  }

  function choose(p: Preset) {
    setPending(p);
    setError(null);
    if (!getSessionSelfie()) {
      setStage("camera");
      return;
    }
    void run(p);
  }

  async function onCaptured(r: CaptureResult) {
    if (!r.final.landmarks) return;
    setSessionSelfie({
      bitmap: await createImageBitmap(r.image.bitmap),
      width: r.image.width,
      height: r.image.height,
      landmarks: r.final.landmarks.map((p) => ({ x: p.x * r.image.width, y: p.y * r.image.height })),
      capturedAt: epochNow(),
    });
    r.image.bitmap.close();
    if (pending) void run(pending);
    else setStage("gallery");
  }

  async function run(preset: Preset) {
    const selfie = getSessionSelfie();
    if (!selfie) return;
    setStage("generating");
    setElapsed(0);
    const start = nowMs();
    timerRef.current = window.setInterval(() => setElapsed(Math.round((nowMs() - start) / 1000)), 1000);
    track("tryon_started", { presetKind: preset.kind });
    let eventId: string | null = null;
    try {
      // 1024 px kare kırpım C + kırpım uzayında landmark'lar (SPEC 10.3 adım 4)
      const { blob, box } = await cropForServer(selfie.bitmap, selfie.landmarks, CROP_SIZE);
      const landmarksC = landmarksToCrop(selfie.landmarks, box, CROP_SIZE);
      const c = await createImageBitmap(blob);
      const res = await postJson<{ eventId: string; image: string; mimeType: string }>("/api/tryon", {
        clientRequestId: crypto.randomUUID(),
        presetId: preset.id,
        image: await blobToBase64(blob),
      });
      if (!res) throw new Error("empty");
      eventId = res.eventId;
      const gBlob = await (await fetch(`data:${res.mimeType};base64,${res.image}`)).blob();
      const g = await createImageBitmap(gBlob);
      const out = await VisionClient.get().tryon(c, g, landmarksC, preset.protect);
      if (!out.ok) {
        await postJson(`/api/tryon/${eventId}/drift`, {}).catch(() => undefined);
        track("tryon_result", { status: "identity_drift", durationMs: Math.round(nowMs() - start) });
        setError(t("driftMessage"));
        setStage("gallery");
        return;
      }
      const beforeUrl = URL.createObjectURL(blob);
      const afterBlob = await bitmapToBlob(out.image);
      setResult({ eventId, preset, beforeUrl, afterUrl: URL.createObjectURL(afterBlob), afterBitmap: out.image });
      setUsed((u) => u + 1);
      track("tryon_result", { status: "success", durationMs: Math.round(nowMs() - start) });
      setStage("result");
    } catch (e) {
      const code = e instanceof ApiClientError ? e.code : "NETWORK";
      track("tryon_result", { status: code, durationMs: Math.round(nowMs() - start) });
      setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.GENERIC"));
      setStage("gallery");
    } finally {
      window.clearInterval(timerRef.current);
    }
  }

  async function download() {
    if (!result) return;
    const blob = await stampAiLabel(result.afterBitmap, tc("aiGenerated"));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aura-deneme-${result.preset.id}.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }

  function back() {
    if (result) {
      URL.revokeObjectURL(result.beforeUrl);
      URL.revokeObjectURL(result.afterUrl);
      result.afterBitmap.close();
    }
    setResult(null);
    setStage("gallery");
  }

  if (!consent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("consent.title")}</CardTitle>
          <CardDescription>{t("consent.body")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {(["b1", "b2", "b3", "b4"] as const).map((k) => <li key={k}>{t(`consent.${k}`)}</li>)}
          </ul>
          <Button className="w-full" size="lg" onClick={giveConsent}>{t("consent.accept")}</Button>
        </CardContent>
      </Card>
    );
  }

  if (stage === "camera") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("needSelfie")}</p>
        <SelfieCamera onCapture={(r) => void onCaptured(r)} />
        <Button variant="ghost" className="w-full" onClick={() => setStage("gallery")}>{t("back")}</Button>
      </div>
    );
  }

  if (stage === "generating") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("generating.title", { name: pending?.nameTr ?? "" })}</CardTitle>
          <CardDescription>{elapsed > 45 ? t("generating.slow") : t("generating.body")}</CardDescription>
        </CardHeader>
        <CardContent><p className="text-sm tabular-nums text-muted-foreground">{t("generating.elapsed", { s: elapsed })}</p></CardContent>
      </Card>
    );
  }

  if (stage === "result" && result) {
    return (
      <div className="space-y-3">
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element -- yerel blob */}
          <img src={result.afterUrl} alt={t("afterAlt")} className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 overflow-hidden" style={{ width: `${slider}%` }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- yerel blob */}
            <img src={result.beforeUrl} alt={t("beforeAlt")} className="size-full max-w-none object-cover" style={{ width: `${10000 / Math.max(slider, 1)}%` }} />
          </div>
          <div className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${slider}%` }} aria-hidden="true" />
          <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">{tc("aiGenerated")}</span>
          <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">{t("before")}</span>
          <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">{t("after")}</span>
        </div>
        <Slider value={[slider]} onValueChange={(v) => setSlider(v[0] ?? 50)} min={0} max={100} step={1} aria-label={t("sliderAria")} />
        <p className="text-center text-sm">{result.preset.nameTr}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={download}><Download aria-hidden="true" /> {t("download")}</Button>
          <Button onClick={back}>{t("tryAnother")}</Button>
        </div>
        <FeedbackButtons targetType="tryon" targetId={result.eventId} />
        <p className="text-xs text-muted-foreground">{t("resultNote")}</p>
      </div>
    );
  }

  const remaining = Math.max(0, quota.limit - used);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("remaining", { n: remaining, limit: quota.limit })}</span>
        {remaining === 0 && quota.nextAt ? <span className="text-xs text-muted-foreground">{t("nextAt", { date: new Date(quota.nextAt).toLocaleDateString("tr-TR") })}</span> : null}
      </div>
      {error ? <p role="alert" className="rounded-md border px-3 py-2 text-sm">{error}</p> : null}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Kind)}>
        <TabsList className="w-full">
          {recommended.length ? <TabsTrigger value="recommended" className="flex-1">{t("tabs.recommended")}</TabsTrigger> : null}
          <TabsTrigger value="hair" className="flex-1">{t("tabs.hair")}</TabsTrigger>
          <TabsTrigger value="beard" className="flex-1">{t("tabs.beard")}</TabsTrigger>
          <TabsTrigger value="color" className="flex-1">{t("tabs.color")}</TabsTrigger>
        </TabsList>
      </Tabs>
      <ul className="grid grid-cols-2 gap-2">
        {list.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={remaining === 0}
              onClick={() => choose(p)}
              className="flex h-full w-full flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm hover:bg-accent disabled:opacity-50"
            >
              <span className="font-medium">{p.nameTr}</span>
              {p.noteTr ? <span className="text-xs text-muted-foreground">{p.noteTr}</span> : null}
              {recommended.includes(p.id) ? <Badge variant="secondary" className="mt-auto">{t("recommendedBadge")}</Badge> : null}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t("galleryNote")}</p>
    </div>
  );
}

async function bitmapToBlob(bitmap: ImageBitmap): Promise<Blob> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
}
