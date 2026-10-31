"use client";

import { ArrowUpRight, Camera, CameraOff, ChevronDown, CircleCheck, ImageUp, LoaderCircle, RotateCcw, Scale, ScanFace, Send, ShieldCheck, Smartphone, Smile, Sun, TriangleAlert, User } from "lucide-react";
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
    const ok = Boolean(review.result);
    return (
      <Card className="bg-hero-glow">
        <CardHeader className="text-center">
          <span
            aria-hidden="true"
            className={cn("mx-auto mb-1 grid size-12 place-items-center rounded-2xl", ok ? "bg-brand-soft text-brand" : "bg-warn/12 text-warn")}
          >
            {ok ? <CircleCheck className="size-6" /> : <TriangleAlert className="size-6" />}
          </span>
          <CardTitle className="text-xl font-bold">{ok ? t("review.okTitle") : t("review.failTitle")}</CardTitle>
          <CardDescription>{ok ? t("review.okBody") : t(`issues.${review.report.issues[0] ?? "no_face"}`)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- yerel blob, next/image uygun değil */}
          <img src={review.url} alt="" className="mx-auto max-h-[50dvh] rounded-2xl border shadow-card" />
          {review.report.warnings[0] ? <p className="text-center text-xs text-muted-foreground">{t(`warnings.${review.report.warnings[0]}`)}</p> : null}
          {review.result?.relaxed ? (
            <p className="flex gap-2.5 rounded-xl border border-dashed p-3 text-[13px] text-muted-foreground">
              <Sun aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warn" />
              <span>{t("review.relaxedNote")}</span>
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button variant={ok ? "outline" : "default"} size="lg" className="flex-1" onClick={retake}>
              <RotateCcw aria-hidden="true" /> {t("review.retake")}
            </Button>
            {ok ? (
              <Button size="lg" className="flex-1" onClick={useResult}>
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
      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck aria-hidden="true" className="mt-px size-3.5 shrink-0 text-brand" />
        <span>{t("guide.privacy")}</span>
      </p>
    ) : (
      <section aria-labelledby="camera-trust-title" className="space-y-2.5 rounded-xl border bg-muted/40 p-3.5">
        <h3 id="camera-trust-title" className="flex items-center gap-2 text-[13px] font-semibold">
          <ShieldCheck aria-hidden="true" className="size-4 text-brand" />
          {t("trust.title")}
        </h3>
        <ul className="space-y-2 text-[13px] leading-snug text-muted-foreground">
          {(
            [
              [Smartphone, t("trust.deviceShort")],
              [Send, t("trust.sentShort", { provider: aiProviderName })],
              [Scale, t("trust.limitsShort")],
            ] as const
          ).map(([Icon, text]) => (
            <li key={text} className="flex items-start gap-2.5">
              <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                <Icon className="size-3.5" />
              </span>
              <span className="pt-0.5">{text}</span>
            </li>
          ))}
        </ul>
      </section>
    );

  if (stage === "guide" || stage === "denied" || stage === "model_error") {
    const title = stage === "denied" ? t("denied.title") : stage === "model_error" ? t("modelError.title") : t("guide.title");
    const body = stage === "denied" ? t("denied.body") : stage === "model_error" ? t("modelError.body") : t("guide.lead");
    return (
      <Card className="bg-hero-glow">
        <CardHeader className="items-center text-center">
          {stage === "guide" ? (
            <FaceGuideArt />
          ) : (
            <span aria-hidden="true" className="mx-auto mb-1 grid size-14 place-items-center rounded-2xl bg-warn/12 text-warn">
              {stage === "denied" ? <CameraOff className="size-7" /> : <TriangleAlert className="size-7" />}
            </span>
          )}
          {stage === "guide" && aiProviderName !== undefined ? <p className="eyebrow">{t("guide.eyebrow")}</p> : null}
          <CardTitle className="text-2xl font-bold">{title}</CardTitle>
          <CardDescription className="text-[13px]">{body}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stage === "guide" ? (
            <ul className="grid grid-cols-2 gap-2">
              {(["light", "neutral", "frame", "alone"] as const).map((k, i) => {
                const Icon = TIP_ICONS[k];
                return (
                  <li
                    key={k}
                    className="flex min-h-14 items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 motion-safe:animate-fade-up"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                      <Icon className="size-4" />
                    </span>
                    <span className="text-[13px] leading-tight font-semibold">{t(`guide.tipsShort.${k}`)}</span>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {stage === "guide" ? trust : null}
          {issue ? (
            <p role="status" className="flex items-start gap-2.5 rounded-xl border border-dashed p-3 text-sm">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warn" />
              <span>{issue}</span>
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
          {stage === "guide" ? (
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground">
                {t("guide.tipsMore")}
                <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="space-y-1.5 pb-1 text-[13px] leading-relaxed text-muted-foreground">
                <li>{t("guide.body")}</li>
                {(["light", "neutral", "frame", "alone"] as const).map((k) => (
                  <li key={k}>{t(`guide.tips.${k}`)}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {aiProviderName !== undefined ? (
            <Link
              href="/yontem?from=guide"
              className="-mt-2 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-brand underline-offset-4 hover:underline"
            >
              {t("trust.methodLink")}
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          ) : null}
          {fileInput}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-3xl border bg-black shadow-card">
        <video ref={videoRef} playsInline muted autoPlay className="size-full -scale-x-100 object-cover" />
        <svg viewBox="0 0 300 400" className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
          <defs>
            <linearGradient id="oval-ok" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--brand-from)" />
              <stop offset="100%" stopColor="var(--brand-to)" />
            </linearGradient>
            <mask id="oval-cut">
              <rect width="300" height="400" fill="white" />
              <ellipse cx="150" cy="190" rx="105" ry="145" fill="black" />
            </mask>
          </defs>
          <rect width="300" height="400" fill="rgba(0,0,0,0.35)" mask="url(#oval-cut)" />
          <ellipse
            cx="150"
            cy="190"
            rx="105"
            ry="145"
            fill="none"
            stroke={issue ? "rgba(255,255,255,0.7)" : "url(#oval-ok)"}
            strokeWidth={issue ? 2.5 : 4}
            strokeDasharray={issue ? "6 6" : undefined}
          />
        </svg>
        {stage === "countdown" ? (
          <div className="absolute inset-0 flex items-center justify-center" aria-live="assertive">
            <span className="num text-display font-bold text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]">{countdown || 1}</span>
          </div>
        ) : null}
        {stage === "loading" || stage === "processing" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-sm font-medium text-white">
            <LoaderCircle aria-hidden="true" className="size-8 motion-safe:animate-spin" />
            {stage === "loading" ? (modelReady ? t("live.startingCamera") : t("live.loadingModel")) : t("live.processing")}
          </div>
        ) : null}
        <p
          role="status"
          aria-live="polite"
          className="absolute inset-x-4 bottom-4 flex min-h-11 items-center justify-center gap-2 rounded-full bg-black/60 px-4 text-center text-sm font-semibold text-white backdrop-blur-md"
        >
          <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", issue ? "bg-warn" : "bg-success")} />
          {issue ?? warning ?? (stage === "countdown" ? t("live.holdStill") : t("live.ready"))}
        </p>
      </div>
      {manualOffered && (stage === "live" || stage === "countdown") ? (
        <div className="space-y-1.5 text-center">
          <Button size="lg" className="w-full max-w-sm" onClick={() => void captureNow()}>
            <Camera aria-hidden="true" /> {t("live.manual")}
          </Button>
          <p className="mx-auto max-w-sm text-[11px] leading-relaxed text-muted-foreground">{t("live.manualHint")}</p>
        </div>
      ) : null}
      <div className="flex justify-center gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            stopCamera();
            resetLiveState();
            setStage("guide");
          }}
        >
          {t("live.cancel")}
        </Button>
        <Button variant="ghost" onClick={() => fileRef.current?.click()}>
          <ImageUp aria-hidden="true" /> {t("guide.upload")}
        </Button>
      </div>
      {fileInput}
    </div>
  );
}

/** Rehber ekranının görseli: marka gradyanlı oval kılavuz (dekoratif). */
function FaceGuideArt() {
  return (
    <div aria-hidden="true" className="relative mx-auto mb-2 grid size-28 place-items-center">
      <div className="absolute inset-2 rounded-full bg-brand-soft blur-xl" />
      <svg viewBox="0 0 100 120" className="relative h-28 w-24">
        <defs>
          <linearGradient id="guide-oval" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand-from)" />
            <stop offset="100%" stopColor="var(--brand-to)" />
          </linearGradient>
        </defs>
        <ellipse cx="50" cy="60" rx="40" ry="54" fill="none" stroke="url(#guide-oval)" strokeWidth="3" strokeDasharray="10 7" strokeLinecap="round" />
      </svg>
      <ScanFace className="absolute size-10 text-brand" />
    </div>
  );
}

async function bitmapToBlob(bitmap: ImageBitmap): Promise<Blob> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
}
