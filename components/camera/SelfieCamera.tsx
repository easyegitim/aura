"use client";

import { Camera, ImageUp, RotateCcw, Scale, ScanFace, Send, Smartphone, Smile, Sun, User } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { track } from "@/lib/analytics";
import { VisionClient } from "@/lib/face/client";
import { PreprocessError, loadImageFile, resizeToAnalysis, type LoadedImage } from "@/lib/face/preprocess";
import { MANUAL_QUALITY_CONFIG, QUALITY_CONFIG, checkQuality, manualOfferReady, type QualityReport } from "@/lib/face/quality";
import type { FrameAnalysis } from "@/lib/face/types";
import { cn } from "@/lib/utils";

export type CaptureResult = {
  /** Analiz kopyası (uzun kenar ≤ 1280). Kullanıcı sonucu bırakınca close() çağrılır. */
  image: LoadedImage;
  /** Son karenin analizi (ham noktalar dahil; yalnız bellekte). */
  final: FrameAnalysis;
  /** Çekimden önceki en fazla 5 geçerli canlı kare (SPEC 7.5 medyan için). */
  recentFrames: FrameAnalysis[];
  quality: QualityReport;
  source: "camera" | "gallery";
  /** Elle çekim ("Şimdi çek") ve sıkı kontrol geçmedi. Yalnız saklanan üst veri; skoru değiştirmez (C7). */
  relaxed: boolean;
};

type Stage = "guide" | "loading" | "live" | "countdown" | "processing" | "review" | "denied" | "model_error";

type Props = {
  onCapture: (r: CaptureResult) => void;
  /** Analiz akışında güven bloğundaki sağlayıcı adı; hukuki onaya kadar nötr "yapay zekâ" (UI spec §5.3).
   *  Verilmezse (ör. deneme ekranı) güven bloğu yerine eski kısa gizlilik notu gösterilir. */
  aiProviderName?: string;
};

const TIP_ICONS = { light: Sun, neutral: Smile, frame: ScanFace, alone: User } as const;

/** SPEC 7 / Faz 4: rehber → kamera (aynalı, oval kılavuz, tek satır uyarı) → 600 ms kararlı → 3-2-1 → çekim; galeriden yükleme. */
export function SelfieCamera({ onCapture, aiProviderName }: Props) {
  const t = useTranslations("camera");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number>(0);
  const busyRef = useRef(false);
  const lastRunRef = useRef(0);
  const stableSinceRef = useRef<number | null>(null);
  const recentRef = useRef<FrameAnalysis[]>([]);
  const stageRef = useRef<Stage>("guide");
  const attemptsRef = useRef(0);
  const countdownEndRef = useRef<number | null>(null);
  const liveStartedAtRef = useRef<number | null>(null);
  const manualOfferedRef = useRef(false);

  const [stage, setStageState] = useState<Stage>("guide");
  const [issue, setIssue] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [review, setReview] = useState<{ url: string; report: QualityReport; result: CaptureResult | null } | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [manualOffered, setManualOffered] = useState(false);

  const setStage = useCallback((s: Stage) => {
    stageRef.current = s;
    setStageState(s);
  }, []);

  // Model arka planda yüklenir (onboarding sırasında prefetch edilmiş olabilir).
  useEffect(() => {
    let cancelled = false;
    VisionClient.get()
      .init()
      .then(() => {
        if (!cancelled) setModelReady(true);
      })
      .catch(() => {
        if (!cancelled) setStage("model_error");
      });
    return () => {
      cancelled = true;
    };
  }, [setStage]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  /** Canlı akışın kalıntılarını temizler: eski kareler galeri sonucuna veya yeni çekime karışmaz. */
  const resetLiveState = useCallback(() => {
    recentRef.current = [];
    stableSinceRef.current = null;
    countdownEndRef.current = null;
    liveStartedAtRef.current = null;
    manualOfferedRef.current = false;
    setManualOffered(false);
    setIssue(null);
    setWarning(null);
  }, []);

  const finalizeCapture = useCallback(
    async (bitmap: ImageBitmap, source: "camera" | "gallery", opts: { manual?: boolean } = {}) => {
      setStage("processing");
      const client = VisionClient.get();
      let image: LoadedImage | null = null;
      try {
        image = await resizeToAnalysis(bitmap);
        const forWorker = await createImageBitmap(image.bitmap);
        const final = await client.detectImage(forWorker);
        // Galeri yüklemeleri sıkı kontrolde kalır (SPEC 7.3); gevşek eşikler yalnız elle çekimde.
        const strict = checkQuality(final);
        const report = opts.manual ? checkQuality(final, MANUAL_QUALITY_CONFIG) : strict;
        if (opts.manual) track("capture_manual_used", { issue: strict.issues[0] ?? "none" });
        const url = URL.createObjectURL(await bitmapToBlob(image.bitmap));
        if (report.passed) {
          attemptsRef.current++;
          track("capture_succeeded", { attempts: attemptsRef.current });
          const result: CaptureResult = {
            image,
            final,
            recentFrames: source === "gallery" ? [] : recentRef.current.slice(-5),
            quality: report,
            source,
            relaxed: opts.manual === true && !strict.passed,
          };
          setReview({ url, report, result });
        } else {
          attemptsRef.current++;
          track("capture_quality_failed", { reason: report.issues[0] ?? "unknown" });
          image.bitmap.close();
          setReview({ url, report, result: null });
        }
        setStage("review");
      } catch {
        image?.bitmap.close();
        // Kamera bu noktada durdurulmuştur: canlı görünüme dönmek ölü bir önizleme bırakırdı.
        resetLiveState();
        setIssue(t("errors.processing"));
        setStage("guide");
      } finally {
        bitmap.close();
      }
    },
    [resetLiveState, setStage, t],
  );

  const loopRef = useRef<() => Promise<void>>(async () => {});
  const loop = useCallback(async () => {
    const video = videoRef.current;
    const stage = stageRef.current;
    if (!video || (stage !== "live" && stage !== "countdown")) return;
    const now = performance.now();
    const interval = 1000 / QUALITY_CONFIG.maxFps;
    if (!busyRef.current && now - lastRunRef.current >= interval && video.readyState >= 2) {
      busyRef.current = true;
      lastRunRef.current = now;
      try {
        const bitmap = await createImageBitmap(video);
        const frame = await VisionClient.get().detectVideo(bitmap, now);
        const report = checkQuality(frame);
        if (stageRef.current !== "live" && stageRef.current !== "countdown") return;
        setIssue(report.issues[0] ? t(`issues.${report.issues[0]}`) : null);
        // 8 sn sonra yalnız yumuşak sorunlar kaldıysa "Şimdi çek" (canlı akış bitene kadar kalır).
        if (!manualOfferedRef.current && liveStartedAtRef.current !== null && manualOfferReady(frame, now - liveStartedAtRef.current)) {
          manualOfferedRef.current = true;
          setManualOffered(true);
          track("capture_manual_offered");
        }
        setWarning(report.warnings[0] ? t(`warnings.${report.warnings[0]}`) : null);
        if (report.passed) {
          recentRef.current = [...recentRef.current.slice(-4), frame];
          stableSinceRef.current ??= now;
          if (stageRef.current === "live" && now - stableSinceRef.current >= QUALITY_CONFIG.stableMs) {
            countdownEndRef.current = now + QUALITY_CONFIG.countdownSeconds * 1000;
            setStage("countdown");
          }
          if (stageRef.current === "countdown" && countdownEndRef.current !== null) {
            const remaining = Math.ceil((countdownEndRef.current - now) / 1000);
            setCountdown(Math.max(remaining, 0));
            if (now >= countdownEndRef.current) {
              countdownEndRef.current = null;
              stableSinceRef.current = null;
              const full = await createImageBitmap(video);
              stopCamera();
              await finalizeCapture(full, "camera");
              return;
            }
          }
        } else {
          stableSinceRef.current = null;
          recentRef.current = [];
          if (stageRef.current === "countdown") {
            countdownEndRef.current = null;
            setStage("live");
          }
        }
      } catch {
        // kare atlandı
      } finally {
        busyRef.current = false;
      }
    }
    rafRef.current = requestAnimationFrame(() => void loopRef.current());
  }, [finalizeCapture, setStage, stopCamera, t]);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  async function startCamera() {
    track("capture_started", { source: "camera" });
    setStage("loading");
    try {
      await VisionClient.get().init();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      resetLiveState();
      liveStartedAtRef.current = performance.now();
      setStage("live");
      rafRef.current = requestAnimationFrame(() => void loopRef.current());
    } catch (err) {
      stopCamera();
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "NotFoundError" || name === "NotReadableError" || name === "OverconstrainedError") {
        setStage("denied");
      } else {
        setStage("model_error");
      }
    }
  }

  async function onFile(file: File | undefined) {
    resetLiveState();
    if (!file) return;
    track("capture_started", { source: "gallery" });
    setStage("loading");
    try {
      await VisionClient.get().init();
      const loaded = await loadImageFile(file);
      await finalizeCapture(loaded.bitmap, "gallery");
    } catch (err) {
      if (err instanceof PreprocessError) setIssue(t(`errors.${err.code}`));
      else setIssue(t("errors.processing"));
      setStage("guide");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function retake() {
    if (review) URL.revokeObjectURL(review.url);
    review?.result?.image.bitmap.close();
    setReview(null);
    resetLiveState();
    setStage("guide");
  }

  /** "Şimdi çek": o anki kare gevşek eşiklerle denetlenir; sert sorunlar yine engeller. */
  async function captureNow() {
    const video = videoRef.current;
    if (!video || (stageRef.current !== "live" && stageRef.current !== "countdown")) return;
    setStage("processing");
    let full: ImageBitmap;
    try {
      full = await createImageBitmap(video);
    } catch {
      stopCamera();
      resetLiveState();
      setIssue(t("errors.processing"));
      setStage("guide");
      return;
    }
    stopCamera();
    await finalizeCapture(full, "camera", { manual: true });
  }

  function useResult() {
    if (!review?.result) return;
    const r = review.result;
    URL.revokeObjectURL(review.url);
    setReview(null);
    onCapture(r);
  }

  const fileInput = (
    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
  );

  if (stage === "review" && review) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{review.result ? t("review.okTitle") : t("review.failTitle")}</CardTitle>
          <CardDescription>{review.result ? t("review.okBody") : t(`issues.${review.report.issues[0] ?? "no_face"}`)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- yerel blob, next/image uygun değil */}
          <img src={review.url} alt="" className="mx-auto max-h-[50dvh] rounded-lg" />
          {review.report.warnings[0] ? <p className="text-xs text-muted-foreground">{t(`warnings.${review.report.warnings[0]}`)}</p> : null}
          {review.result?.relaxed ? <p className="text-sm text-muted-foreground">{t("review.relaxedNote")}</p> : null}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={retake}>
              <RotateCcw aria-hidden="true" /> {t("review.retake")}
            </Button>
            {review.result ? (
              <Button className="flex-1" onClick={useResult}>
                {t("review.use")}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Güven bloğu (UI spec §5.1): ekstra dokunma yok; "Kamerayı aç" kartın ilk düğmesi kalır.
  const trust =
    aiProviderName === undefined ? (
      <p className="text-xs text-muted-foreground">{t("guide.privacy")}</p>
    ) : (
      <section aria-labelledby="camera-trust-title" className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
        <h3 id="camera-trust-title" className="font-medium">
          {t("trust.title")}
        </h3>
        <ul className="space-y-2 text-muted-foreground">
          <li className="flex items-start gap-2">
            <Smartphone className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
            <span>{t("trust.device")}</span>
          </li>
          <li className="flex items-start gap-2">
            <Send className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
            <span>{t("trust.sent", { provider: aiProviderName })}</span>
          </li>
          <li className="flex items-start gap-2">
            <Scale className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
            <span>{t("trust.limits")}</span>
          </li>
        </ul>
      </section>
    );

  if (stage === "guide" || stage === "denied" || stage === "model_error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{stage === "denied" ? t("denied.title") : stage === "model_error" ? t("modelError.title") : t("guide.title")}</CardTitle>
          <CardDescription>{stage === "denied" ? t("denied.body") : stage === "model_error" ? t("modelError.body") : t("guide.body")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stage === "guide" ? (
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {(["light", "neutral", "frame", "alone"] as const).map((k) => {
                const Icon = TIP_ICONS[k];
                return (
                  <li key={k} className="flex items-start gap-2 rounded-lg border p-2 text-muted-foreground">
                    <Icon className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
                    <span>{t(`guide.tips.${k}`)}</span>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {stage === "guide" ? trust : null}
          {issue ? (
            <p role="status" className="rounded-md border px-3 py-2 text-sm">
              {issue}
            </p>
          ) : null}
          <div className="grid gap-2">
            {stage !== "denied" ? (
              <Button size="lg" onClick={startCamera} disabled={stage === "model_error"}>
                <Camera aria-hidden="true" /> {t("guide.open")}
              </Button>
            ) : null}
            <Button size="lg" variant={stage === "denied" ? "default" : "outline"} onClick={() => fileRef.current?.click()}>
              <ImageUp aria-hidden="true" /> {t("guide.upload")}
            </Button>
            {stage === "model_error" ? (
              <Button variant="ghost" onClick={() => location.reload()}>
                {t("modelError.retry")}
              </Button>
            ) : null}
          </div>
          {stage !== "guide" ? trust : null}
          {aiProviderName !== undefined ? (
            <Link href="/yontem?from=guide" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">
              {t("trust.methodLink")}
            </Link>
          ) : null}
          {fileInput}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} playsInline muted autoPlay className="size-full -scale-x-100 object-cover" />
        <svg viewBox="0 0 300 400" className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
          <ellipse cx="150" cy="190" rx="105" ry="145" fill="none" stroke={issue ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.95)"} strokeWidth="2.5" strokeDasharray={issue ? "6 6" : undefined} />
        </svg>
        {stage === "countdown" ? (
          <div className="absolute inset-0 flex items-center justify-center text-7xl font-semibold text-white drop-shadow" aria-live="assertive">
            {countdown || 1}
          </div>
        ) : null}
        {stage === "loading" || stage === "processing" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white">
            {stage === "loading" ? (modelReady ? t("live.startingCamera") : t("live.loadingModel")) : t("live.processing")}
          </div>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className={cn("min-h-6 text-center text-sm", issue ? "" : "text-muted-foreground")}>
        {issue ?? warning ?? (stage === "countdown" ? t("live.holdStill") : t("live.ready"))}
      </p>
      {manualOffered && (stage === "live" || stage === "countdown") ? (
        <div className="space-y-1 text-center">
          <Button size="lg" className="w-full max-w-sm" onClick={() => void captureNow()}>
            <Camera aria-hidden="true" /> {t("live.manual")}
          </Button>
          <p className="mx-auto max-w-sm text-xs text-muted-foreground">{t("live.manualHint")}</p>
        </div>
      ) : null}
      <div className="flex justify-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            stopCamera();
            resetLiveState();
            setStage("guide");
          }}
        >
          {t("live.cancel")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
          <ImageUp aria-hidden="true" /> {t("guide.upload")}
        </Button>
      </div>
      {fileInput}
    </div>
  );
}

async function bitmapToBlob(bitmap: ImageBitmap): Promise<Blob> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
}
