"use client";

import { Camera, ChevronsLeftRight, Crop, Download, Palette, RotateCcw, ScanFace, Scissors, ServerOff, ShieldCheck, Shuffle, Smartphone, Smile, Sparkles, type LucideIcon } from "lucide-react";
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
import { driftPolicyFor, stampAiLabel } from "@/lib/tryon/composite";
import { base64ToBlob } from "@/lib/tryon/base64";
import { cn } from "@/lib/utils";

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
      const gBlob = base64ToBlob(res.image, res.mimeType); // fetch("data:") CSP tarafından engellenir
      const g = await createImageBitmap(gBlob);
      const out = await VisionClient.get().tryon(c, g, landmarksC, preset.protect, driftPolicyFor(preset));
      if (!out.ok) {
        console.warn("[tryon] kontrol başarısız:", out.reason); // yalnız neden kodu; görsel/nokta yok
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
      <Card className="bg-hero-glow">
        <CardHeader>
          <span aria-hidden="true" className="mb-1 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
            <ShieldCheck className="size-6" />
          </span>
          <p className="eyebrow">{t("consent.eyebrow")}</p>
          <CardTitle className="text-xl font-bold">{t("consent.title")}</CardTitle>
          <CardDescription className="text-[13px]">{t("consent.body")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2.5">
            {CONSENT_POINTS.map(({ k, icon: Icon }) => (
              <li key={k} className="flex items-start gap-3 text-[13px] leading-relaxed">
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="size-4" />
                </span>
                <span className="pt-1">{t(`consent.${k}`)}</span>
              </li>
            ))}
          </ul>
          <Button className="w-full" size="lg" onClick={giveConsent}>{t("consent.accept")}</Button>
        </CardContent>
      </Card>
    );
  }

  if (stage === "camera") {
    return (
      <div className="space-y-3">
        <p className="flex gap-3 rounded-2xl border border-dashed p-4 text-[13px] leading-relaxed text-muted-foreground">
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <Camera className="size-4" />
          </span>
          <span>{t("needSelfie")}</span>
        </p>
        <SelfieCamera onCapture={(r) => void onCaptured(r)} />
        <Button variant="ghost" className="w-full" onClick={() => setStage("gallery")}>{t("back")}</Button>
      </div>
    );
  }

  if (stage === "generating") {
    return <TryonGenerating name={pending?.nameTr ?? ""} elapsed={elapsed} />;
  }

  if (stage === "result" && result) {
    return (
      <div className="space-y-4">
        <BeforeAfter beforeUrl={result.beforeUrl} afterUrl={result.afterUrl} slider={slider} onSlider={setSlider} name={result.preset.nameTr} />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" onClick={download}><Download aria-hidden="true" /> {t("download")}</Button>
          <Button size="lg" onClick={back}><Shuffle aria-hidden="true" /> {t("tryAnother")}</Button>
        </div>
        <FeedbackButtons targetType="tryon" targetId={result.eventId} />
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t("resultNote")}</p>
      </div>
    );
  }

  const remaining = Math.max(0, quota.limit - used);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-card">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="eyebrow">{t("remainingLabel")}</p>
          <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-track">
            <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${quota.limit ? (remaining / quota.limit) * 100 : 0}%` }} />
          </div>
          {remaining === 0 && quota.nextAt ? (
            <p className="text-[11px] text-muted-foreground">{t("nextAt", { date: new Date(quota.nextAt).toLocaleDateString("tr-TR") })}</p>
          ) : null}
        </div>
        <p className="num shrink-0 text-right" aria-label={t("remaining", { n: remaining, limit: quota.limit })}>
          <span aria-hidden="true" className="text-3xl font-bold text-brand-gradient">{remaining}</span>
          <span aria-hidden="true" className="text-sm text-muted-foreground"> / {quota.limit}</span>
        </p>
      </div>
      {error ? (
        <div role="alert" className="flex gap-3 rounded-2xl border border-dashed p-4">
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-xl bg-warn/12 text-warn">
            <RotateCcw className="size-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium">{error}</p>
            {pending && remaining > 0 ? (
              <Button size="sm" variant="outline" className="h-11 rounded-xl" onClick={() => choose(pending)}>
                {t("retry")} · {pending.nameTr}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Kind)}>
        <TabsList className="w-full rounded-xl p-1 group-data-[orientation=horizontal]/tabs:h-11">
          {recommended.length ? <TabsTrigger value="recommended" className="flex-1 rounded-lg text-[13px]">{t("tabs.recommended")}</TabsTrigger> : null}
          <TabsTrigger value="hair" className="flex-1 rounded-lg text-[13px]">{t("tabs.hair")}</TabsTrigger>
          <TabsTrigger value="beard" className="flex-1 rounded-lg text-[13px]">{t("tabs.beard")}</TabsTrigger>
          <TabsTrigger value="color" className="flex-1 rounded-lg text-[13px]">{t("tabs.color")}</TabsTrigger>
        </TabsList>
      </Tabs>
      <ul className="grid grid-cols-2 gap-2.5">
        {list.map((p, i) => {
          const rec = recommended.includes(p.id);
          const Icon = KIND_ICON[p.kind];
          return (
            <li key={p.id} className="motion-safe:animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
              <button
                type="button"
                disabled={remaining === 0}
                onClick={() => choose(p)}
                className={cn(
                  "flex h-full min-h-28 w-full flex-col items-start gap-2 rounded-2xl p-3.5 text-left transition-colors active:scale-[0.98] disabled:opacity-50",
                  rec ? "border-brand-gradient shadow-glow" : "border bg-card shadow-card hover:bg-accent",
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span aria-hidden="true" className="grid size-8 place-items-center rounded-xl bg-brand-soft text-brand">
                    <Icon className="size-4" />
                  </span>
                  {rec ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand">
                      <Sparkles aria-hidden="true" className="size-3" />
                      {t("recommendedBadge")}
                    </span>
                  ) : null}
                </span>
                <span className="text-[15px] leading-tight font-semibold">{p.nameTr}</span>
                {p.noteTr ? <span className="line-clamp-2 text-xs text-muted-foreground">{p.noteTr}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{t("galleryNote")}</p>
    </div>
  );
}

const KIND_ICON: Record<Preset["kind"], LucideIcon> = { hair: Scissors, beard: Smile, color: Palette };
const CONSENT_POINTS: { k: "b1" | "b2" | "b3" | "b4"; icon: LucideIcon }[] = [
  { k: "b1", icon: Crop },
  { k: "b2", icon: ServerOff },
  { k: "b3", icon: ScanFace },
  { k: "b4", icon: Smartphone },
];

/** Üretim bekleme kartı (sunum; süre üst bileşenden gelir). */
export function TryonGenerating({ name, elapsed }: { name: string; elapsed: number }) {
  const t = useTranslations("tryon");
  return (
    <Card className="bg-hero-glow">
      <CardContent className="flex flex-col items-center gap-4 py-4 text-center">
        <div aria-hidden="true" className="relative grid size-28 place-items-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full motion-safe:animate-spin [animation-duration:1.6s]">
            <defs>
              <linearGradient id="tryon-arc" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--brand-from)" />
                <stop offset="100%" stopColor="var(--brand-to)" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="44" fill="none" stroke="var(--track)" strokeWidth="6" />
            <circle cx="50" cy="50" r="44" fill="none" stroke="url(#tryon-arc)" strokeWidth="6" strokeLinecap="round" strokeDasharray="90 190" />
          </svg>
          <Sparkles className="size-9 text-brand" />
        </div>
        <div role="status" aria-live="polite" className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight">{t("generating.title", { name })}</h2>
          <p className="text-[13px] text-muted-foreground">{elapsed > 45 ? t("generating.slow") : t("generating.body")}</p>
        </div>
        <p className="num inline-flex h-7 items-center rounded-full bg-muted px-3 text-xs font-semibold text-muted-foreground">
          {t("generating.elapsed", { s: elapsed })}
        </p>
      </CardContent>
    </Card>
  );
}

/** Önce/sonra karşılaştırma (sunum). Görseller yalnız yerel blob URL'leri. */
export function BeforeAfter({ beforeUrl, afterUrl, slider, onSlider, name }: { beforeUrl: string; afterUrl: string; slider: number; onSlider: (v: number) => void; name: string }) {
  const t = useTranslations("tryon");
  const tc = useTranslations("common");
  const pill = "absolute rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md";
  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-3xl border bg-black shadow-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- yerel blob */}
        <img src={afterUrl} alt={t("afterAlt")} className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${slider}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- yerel blob */}
          <img src={beforeUrl} alt={t("beforeAlt")} className="size-full max-w-none object-cover" style={{ width: `${10000 / Math.max(slider, 1)}%` }} />
        </div>
        <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white/90" style={{ left: `${slider}%` }} aria-hidden="true">
          <span className="absolute top-1/2 left-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-black shadow-lg">
            <ChevronsLeftRight className="size-4" />
          </span>
        </div>
        <span className={cn(pill, "top-3 left-3")}>{t("before")}</span>
        <span className={cn(pill, "top-3 right-3")}>{t("after")}</span>
        <span className={cn(pill, "right-3 bottom-3 font-medium")}>{tc("aiGenerated")}</span>
      </div>
      <Slider value={[slider]} onValueChange={(v) => onSlider(v[0] ?? 50)} min={0} max={100} step={1} aria-label={t("sliderAria")} className="py-2" />
      <div className="text-center">
        <p className="text-lg font-semibold tracking-tight">{name}</p>
        <p className="text-[11px] text-muted-foreground">{t("sliderHint")}</p>
      </div>
    </div>
  );
}

async function bitmapToBlob(bitmap: ImageBitmap): Promise<Blob> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
}
