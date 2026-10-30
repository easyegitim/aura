"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnalysisProgress } from "@/components/analysis/AnalysisProgress";
import { GeometryOverlay, type OverlaySource } from "@/components/analysis/GeometryOverlay";
import { SelfieCamera, type CaptureResult } from "@/components/camera/SelfieCamera";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { track } from "@/lib/analytics";
import { submitAnalysis } from "@/lib/api/analysisClient";
import { ApiClientError } from "@/lib/api/client";
import { VisionClient } from "@/lib/face/client";
import { cropForServer } from "@/lib/face/crop";
import { qualitySummary } from "@/lib/face/quality";
import { bindSessionSelfie, setSessionSelfie } from "@/lib/face/sessionStore";
import { finishProgress, markDone, startProgress, type ProgressState } from "@/lib/analysis/progressModel";
import type { EngineName } from "@/lib/score/contract";
import { addProgressPhoto } from "@/lib/local/progressStore";
import { Checkbox } from "@/components/ui/checkbox";
import { findHairline, propagateHairline } from "@/lib/face/hairline";
import { computeStableGeometry, toPixels, type GeometryFrame } from "@/lib/face/metrics";
import type { GeometryResult } from "@/lib/face/types";

/** Çekim sonrası cihazda geometri (F06): segmenter → saç çizgisi → 5 kare medyanı → GeometryResult. */
async function computeGeometry(result: CaptureResult): Promise<GeometryResult> {
  const seg = await VisionClient.get().segment(await createImageBitmap(result.image.bitmap));
  const finalPx = result.final.landmarks ? toPixels(result.final.landmarks, result.final.width, result.final.height) : null;
  const hairline = seg && finalPx ? findHairline(finalPx, result.final, seg).point : null;
  // Canlı karelerde segmenter çalıştırılmaz (maliyet); son karede bulunan saç çizgisi göreli konumuyla canlı karelere
  // taşınır (computeStableGeometry çoğunluk ister; aksi halde üst üçte bir hep null kalırdı). Mobil ile aynı kural (M8).
  const frames: GeometryFrame[] = [
    ...result.recentFrames.map((f) => ({ frame: f, hairline: hairline && finalPx && f.landmarks ? propagateHairline(finalPx, hairline, toPixels(f.landmarks, f.width, f.height)) : null })),
    { frame: result.final, hairline },
  ];
  return computeStableGeometry(frames);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** "Sonucun hazır" gösterim süresi ve skor adımının yanıttan sonraki gecikmesi (UI spec §3). */
const READY_HOLD_MS = 700;
const STEP_GAP_MS = 250;

/**
 * /tara ekranı (F05). Çekim sonucu GeometryResult + 768 px JPEG ile POST /api/analyses'e gider.
 * Görüntü ve 478 nokta yalnız bellekte kalır; sunucuya yalnız kırpılmış görüntü ve oranlar gider.
 */
export function CaptureScreen({ engine, aiProviderName }: { engine: EngineName; aiProviderName: string }) {
  const t = useTranslations("camera.captured");
  const ta = useTranslations("analysis");
  const router = useRouter();
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [geometry, setGeometry] = useState<GeometryResult | null>(null);
  const [phase, setPhase] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const capturedAtRef = useRef<number | null>(null);
  const [error, setError] = useState<{ code: string; retryAt?: string } | null>(null);
  const requestIdRef = useRef<string>(crypto.randomUUID());
  const [saveProgress, setSaveProgress] = useState(false);
  const tg = useTranslations("geometry");
  // Ölçü çizgisi kaynağı yalnız bellekteki çekimden (piksel koordinatı); hiçbir yere gönderilmez.
  const source = useMemo<OverlaySource | null>(
    () =>
      result?.final.landmarks
        ? {
            bitmap: result.image.bitmap,
            width: result.image.width,
            height: result.image.height,
            landmarks: result.final.landmarks.map((p) => ({ x: p.x * result.image.width, y: p.y * result.image.height })),
          }
        : null,
    [result],
  );

  async function runAnalysis(r: CaptureResult, g: GeometryResult) {
    setPhase("submitting");
    setError(null);
    // Noktalar ve oranlar gönderimden önce hazır: ilk iki adım tamam (+0 ms, +250 ms).
    let s = markDone(startProgress(Date.now()), "landmarks");
    setProgress(s);
    try {
      const px = r.final.landmarks!.map((p) => ({ x: p.x * r.image.width, y: p.y * r.image.height }));
      const cropping = cropForServer(r.image.bitmap, px);
      cropping.catch(() => undefined); // hata aşağıdaki await'te yakalanır; bekleme sırasında "işlenmemiş ret" olmasın
      await sleep(STEP_GAP_MS);
      s = markDone(s, "ratios");
      setProgress(s);
      const { blob } = await cropping;
      s = markDone(s, "prepare");
      setProgress(s);
      // relaxed yalnız saklanan üst veridir; hiçbir skoru değiştirmez (C7).
      const geometry: GeometryResult = r.relaxed ? { ...g, quality: { ...g.quality, relaxed: true } } : g;
      const analysis = await submitAnalysis({ clientRequestId: requestIdRef.current, geometry, image: blob });
      s = markDone(s, "observe");
      setProgress(s);
      track("analysis_completed", { tier: analysis.overall.locked ? "free" : "premium" });
      if (saveProgress) {
        // SPEC 11.2: yalnız cihazda (IndexedDB); sunucuya gitmez.
        try {
          const canvas = new OffscreenCanvas(r.image.width, r.image.height);
          canvas.getContext("2d")?.drawImage(r.image.bitmap, 0, 0);
          await addProgressPhoto({ blob: await canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 }), analysisId: analysis.id });
        } catch {
          // depolama kapalıysa sessizce geç
        }
      }
      await sleep(STEP_GAP_MS);
      s = finishProgress(markDone(s, "score"));
      setProgress(s);
      setPhase("done");
      await sleep(READY_HOLD_MS);
      // Ölçü çizgileri sonuç ekranında yalnız bu analize bağlı selfie üzerinde çizilir (UI spec S1).
      if (capturedAtRef.current !== null) bindSessionSelfie(analysis.id, capturedAtRef.current);
      router.push(`/analiz/${analysis.id}`);
    } catch (e) {
      const code = e instanceof ApiClientError ? e.code : "NETWORK";
      track("analysis_failed", { reason: code });
      setError({ code, retryAt: e instanceof ApiClientError ? e.retryAt : undefined });
      setProgress(null);
      setPhase("error");
    }
  }

  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    computeGeometry(result)
      .then((g) => {
        if (!cancelled) setGeometry(g);
      })
      .catch(() => {
        if (!cancelled) setGeometry(null);
      });
    return () => {
      cancelled = true;
      result.image.bitmap.close();
    };
  }, [result]);

  if (!result) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <SelfieCamera
          aiProviderName={aiProviderName}
          onCapture={async (r) => {
            requestIdRef.current = crypto.randomUUID();
            setPhase("idle");
            setError(null);
            setGeometry(null);
            setResult(r);
            // SPEC 10.3 adım 3: selfie + landmark'lar oturum boyunca bellekte (IndexedDB'ye yazılmaz).
            if (r.final.landmarks) {
              const capturedAt = Date.now();
              capturedAtRef.current = capturedAt;
              setSessionSelfie({
                bitmap: await createImageBitmap(r.image.bitmap),
                width: r.image.width,
                height: r.image.height,
                landmarks: r.final.landmarks.map((p) => ({ x: p.x * r.image.width, y: p.y * r.image.height })),
                capturedAt,
              });
            }
          }}
        />
      </div>
    );
  }

  if ((phase === "submitting" || phase === "done") && progress) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <AnalysisProgress state={progress} engine={engine} source={source} />
      </div>
    );
  }

  const quality = qualitySummary(result.quality.measures);
  // Sunucu kalite kapısı reddettiyse (hak düşmedi) bu çekimle yeniden denemenin anlamı yok: yeniden çekim birincil.
  const captureRejected = error?.code === "CAPTURE_QUALITY";
  const startDisabled = !geometry || error?.code === "QUOTA_EXCEEDED" || captureRejected;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("body")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <GeometryOverlay source={source} variant="full" showLines={geometry !== null} />
          <ul className="flex flex-wrap gap-1.5" aria-label={t("qualityAria")}>
            {(["light", "sharpness", "framing"] as const).map((k) => (
              <li key={k}>
                <Badge variant="outline">{t(`quality.${k}.${quality[k]}`)}</Badge>
              </li>
            ))}
            {result.source === "gallery" ? (
              <li>
                <Badge variant="outline">{t("fromGallery")}</Badge>
              </li>
            ) : null}
          </ul>
          {geometry ? (
            <p className="text-sm">
              {tg("faceShape")}: <strong>{tg(`shapes.${geometry.faceShape.primary}`)}</strong>
              {geometry.faceShape.secondary ? ` (${tg("between", { other: tg(`shapes.${geometry.faceShape.secondary}`) })})` : null}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground" role="status">
              {tg("computing")}
            </p>
          )}
          <label className="flex items-start gap-3 rounded-md border px-3 py-2 text-sm">
            <Checkbox checked={saveProgress} onCheckedChange={(v) => setSaveProgress(v === true)} className="mt-0.5" />
            <span>
              {t("saveProgress")}
              <span className="block text-xs text-muted-foreground">{t("saveProgressHint")}</span>
            </span>
          </label>
          {error ? (
            <p role="alert" className="rounded-md border px-3 py-2 text-sm">
              {ta.has(`errors.${error.code}`) ? ta(`errors.${error.code}`) : ta("errors.GENERIC")}
              {error.retryAt ? ` ${ta("retryAt", { date: new Date(error.retryAt).toLocaleString("tr-TR") })}` : ""}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button variant={captureRejected ? "default" : "outline"} className="min-h-11 flex-1" onClick={() => setResult(null)}>
              {t("retake")}
            </Button>
            <Button
              variant={captureRejected ? "outline" : "default"}
              className="min-h-11 flex-1"
              disabled={startDisabled}
              onClick={() => geometry && void runAnalysis(result, geometry)}
            >
              {ta("start")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
