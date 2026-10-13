import * as ImagePicker from "expo-image-picker";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, View, useWindowDimensions } from "react-native";
import { MediapipeCamera } from "react-native-mediapipe";
import { Camera, useCameraPermission } from "react-native-vision-camera";
import { track } from "@/lib/analytics";
import { findHairline, propagateHairline } from "@/lib/face/hairline";
import { computeStableGeometry, toPixels, type GeometryFrame } from "@/lib/face/metrics";
import { checkQuality, type QualityReport } from "@/lib/face/quality";
import type { FrameAnalysis, GeometryResult } from "@/lib/face/types";
import type { ClientAnalysis } from "@/lib/score/present";
import { AnalysisProgress } from "@/mobile/src/components/analysis/AnalysisProgress";
import { OvalOverlay } from "@/mobile/src/components/capture/OvalOverlay";
import { Button } from "@/mobile/src/components/ui/Button";
import { Card } from "@/mobile/src/components/ui/Card";
import { Screen } from "@/mobile/src/components/ui/Screen";
import { Text } from "@/mobile/src/components/ui/Text";
import { toFrameAnalysis, type NativeBundle } from "@/mobile/src/features/capture/frame";
import { hairAboveFace } from "@/mobile/src/features/capture/segmentation";
import { initialLive, shouldProcess, stepLive, type LiveState } from "@/mobile/src/features/capture/machine";
import { useSession } from "@/mobile/src/features/session/SessionProvider";
import { ApiClientError } from "@/mobile/src/lib/api";
import { scoped, t as tt } from "@/mobile/src/lib/i18n";
import { detectFaceOnImage, useLiveFaceLandmarker } from "@/mobile/src/native/faceLandmarker";
import { segmentForHairline } from "@/mobile/src/native/segmenter";
import { cropForServerBase64, deleteQuietly, pixelStatsFor, resizeToAnalysis, type LocalImage } from "@/mobile/src/native/images";
import { addProgressPhoto } from "@/mobile/src/lib/progressStore";
import { setSessionSelfie } from "@/mobile/src/features/capture/sessionSelfie";
import { File, Paths } from "expo-file-system";
import { SwitchRow } from "@/mobile/src/components/ui/SwitchRow";
import { radius, spacing, useTheme } from "@/mobile/src/theme";

const t = scoped("camera");
const ta = scoped("analysis");
const tc = scoped("camera.captured");
const tg = scoped("geometry");

type Stage = "guide" | "live" | "countdown" | "processing" | "review" | "submitting" | "denied" | "model_error";
type Review = { image: LocalImage; final: FrameAnalysis; recent: FrameAnalysis[]; report: QualityReport; source: "camera" | "gallery"; geometry: GeometryResult | null };

function newRequestId(): string {
  // crypto.randomUUID Hermes'te var; yoksa yeterince rastgele bir UUID v4
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * /tara (SPEC 7, SPEC-MOBILE M4): rehber → kamera (aynalı, oval, tek satır uyarı) → 600 ms kararlı → 3-2-1 → çekim →
 * kalite kapısı → geometri (5 kare medyanı) → 768 px JPEG → POST /api/analyses → /analiz/[id]. Galeriden yükleme aynı kapıdan geçer.
 * Fotoğraf ve 478 nokta yalnız bellekte/geçici dosyada kalır; sunucuya GeometryResult + kırpılmış JPEG gider.
 */
export default function CaptureScreen() {
  const { colors } = useTheme();
  const { width: winW } = useWindowDimensions();
  const { api } = useSession();
  const { purpose } = useLocalSearchParams<{ purpose?: string }>();
  const forTryon = purpose === "tryon";
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);
  const [stage, setStage] = useState<Stage>("guide");
  const stageRef = useRef<Stage>("guide");
  const liveRef = useRef<LiveState>(initialLive);
  const lastRunRef = useRef(0);
  const recentRef = useRef<FrameAnalysis[]>([]);
  const attemptsRef = useRef(0);
  const capturingRef = useRef(false);
  const [issue, setIssue] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<{ code: string; retryAt?: string } | null>(null);
  const requestIdRef = useRef(newRequestId());
  const [saveProgress, setSaveProgress] = useState(false);

  const go = useCallback((s: Stage) => {
    stageRef.current = s;
    setStage(s);
  }, []);

  const finalize = useCallback(
    async (src: { uri: string; width: number; height: number }, source: "camera" | "gallery") => {
      go("processing");
      let image: LocalImage | null = null;
      try {
        image = await resizeToAnalysis(src.uri, src.width, src.height);
        const bundle = await detectFaceOnImage(image.uri);
        const oneFace = bundle.results[0]?.faceLandmarks.length === 1;
        const stats = oneFace ? await pixelStatsFor(image.uri, bundle.results[0].faceLandmarks[0]) : null;
        // M8: segmenter maskesi (yalnız çekilen karede) → saç görünürlüğü uyarısı + saç çizgisi. Modül yoksa null.
        const seg = oneFace ? await segmentForHairline(image.uri) : null;
        const base = toFrameAnalysis(bundle, Date.now(), stats);
        const final: FrameAnalysis = seg && base.landmarks ? { ...base, hairVisible: hairAboveFace(seg, base.landmarks) } : base;
        const report = checkQuality(final);
        attemptsRef.current++;
        let geometry: GeometryResult | null = null;
        if (report.passed) {
          track("capture_succeeded", { attempts: attemptsRef.current });
          const finalPx = toPixels(final.landmarks!, final.width, final.height);
          const hairline = seg ? findHairline(finalPx, final, seg).point : null;
          // Saç çizgisi canlı karelere göreli konumuyla taşınır (computeStableGeometry çoğunluk ister).
          const frames: GeometryFrame[] = [
            ...recentRef.current.slice(-4).map((f) => ({ frame: f, hairline: hairline && f.landmarks ? propagateHairline(finalPx, hairline, toPixels(f.landmarks, f.width, f.height)) : null })),
            { frame: final, hairline },
          ];
          try {
            geometry = computeStableGeometry(frames);
          } catch {
            geometry = null;
          }
        } else {
          track("capture_quality_failed", { reason: report.issues[0] ?? "unknown" });
        }
        setReview({ image, final, recent: recentRef.current.slice(-5), report, source, geometry });
        go("review");
      } catch {
        await deleteQuietly(image?.uri);
        setIssue(t("errors.processing"));
        go("guide");
      } finally {
        if (source === "camera") await deleteQuietly(src.uri);
      }
    },
    [go],
  );

  const takePhoto = useCallback(async () => {
    if (capturingRef.current) return;
    capturingRef.current = true;
    try {
      const photo = await cameraRef.current?.takePhoto({ flash: "off" });
      if (!photo) throw new Error("no_photo");
      await finalize({ uri: `file://${photo.path}`, width: photo.width, height: photo.height }, "camera");
    } catch {
      setIssue(t("errors.processing"));
      go("live");
    } finally {
      capturingRef.current = false;
    }
  }, [finalize, go]);

  const onResults = useCallback(
    (bundle: NativeBundle, now: number) => {
      const s = stageRef.current;
      if (s !== "live" && s !== "countdown") return;
      if (!shouldProcess(lastRunRef.current, now)) return;
      lastRunRef.current = now;
      const frame = toFrameAnalysis(bundle, now);
      const report = checkQuality(frame);
      setIssue(report.issues[0] ? t(`issues.${report.issues[0]}`) : null);
      setWarning(report.warnings[0] ? t(`warnings.${report.warnings[0]}`) : null);
      if (report.passed) recentRef.current = [...recentRef.current.slice(-4), frame];
      else recentRef.current = [];
      const step = stepLive(liveRef.current, report.passed, now);
      liveRef.current = step.state;
      setCountdown(step.countdown);
      const nextStage: Stage = step.state.stage;
      if (nextStage !== stageRef.current && !step.capture) go(nextStage);
      if (step.capture) {
        go("processing");
        void takePhoto();
      }
    },
    [go, takePhoto],
  );
  const onError = useCallback(() => go("model_error"), [go]);
  const solution = useLiveFaceLandmarker(onResults, onError);

  async function startCamera() {
    track("capture_started", { source: "camera" });
    const ok = hasPermission || (await requestPermission());
    if (!ok) {
      go("denied");
      return;
    }
    recentRef.current = [];
    liveRef.current = initialLive;
    setIssue(null);
    go("live");
  }

  async function pickFromGallery() {
    track("capture_started", { source: "gallery" });
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, exif: false });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    if (Math.min(a.width, a.height) < 640) {
      setIssue(t("errors.too_small"));
      return;
    }
    await finalize({ uri: a.uri, width: a.width, height: a.height }, "gallery");
  }

  async function retake() {
    await deleteQuietly(review?.image.uri);
    setReview(null);
    setIssue(null);
    setError(null);
    go("guide");
  }

  /** SPEC 10.3 adım 3: deneme için selfie + landmark'lar oturum boyunca önbellekte (analiz gönderilmez). */
  async function keepForTryon() {
    if (!review?.final.landmarks) return;
    try {
      const dest = new File(Paths.cache, "aura-session-selfie.jpg");
      if (dest.exists) dest.delete();
      await new File(review.image.uri).copy(dest);
      setSessionSelfie({ uri: dest.uri, width: review.image.width, height: review.image.height, landmarksPx: review.final.landmarks.map((p) => ({ x: p.x * review.image.width, y: p.y * review.image.height })), capturedAt: Date.now() });
      await deleteQuietly(review.image.uri);
      router.back();
    } catch {
      setIssue(t("errors.processing"));
    }
  }

  async function submit() {
    if (!review?.geometry || !review.final.landmarks) return;
    go("submitting");
    setError(null);
    try {
      const px = review.final.landmarks.map((p) => ({ x: p.x * review.image.width, y: p.y * review.image.height }));
      const { base64 } = await cropForServerBase64(review.image.uri, px, review.image.width, review.image.height);
      const analysis = await api.post<ClientAnalysis>("/api/analyses", { clientRequestId: requestIdRef.current, geometry: review.geometry, image: base64 });
      if (!analysis) throw new Error("empty_response");
      track("analysis_completed", { tier: analysis.overall.locked ? "free" : "premium" });
      try {
        const dest = new File(Paths.cache, "aura-session-selfie.jpg");
        if (dest.exists) dest.delete();
        await new File(review.image.uri).copy(dest);
        setSessionSelfie({ uri: dest.uri, width: review.image.width, height: review.image.height, landmarksPx: px, capturedAt: Date.now() });
      } catch {
        // deneme için bellek kopyası isteğe bağlıdır
      }
      // SPEC 11.2: yalnız cihazda (uygulama sanal alanı); sunucuya gitmez. Varsayılan kapalı.
      if (saveProgress) await addProgressPhoto(review.image.uri, analysis.id).catch(() => undefined);
      await deleteQuietly(review.image.uri);
      requestIdRef.current = newRequestId();
      router.replace(`/analiz/${analysis.id}`);
    } catch (e) {
      const code = e instanceof ApiClientError ? e.code : "NETWORK";
      track("analysis_failed", { reason: code });
      setError({ code, retryAt: e instanceof ApiClientError ? e.retryAt : undefined });
      go("review");
    }
  }

  useEffect(() => {
    return () => {
      void deleteQuietly(review?.image.uri);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnız ayrılırken temizlik
  }, []);

  const camW = Math.min(winW - spacing.md * 2, 420);
  const camH = Math.round((camW * 4) / 3);

  if (stage === "submitting") {
    return (
      <Screen>
        <AnalysisProgress done={false} />
      </Screen>
    );
  }

  if (stage === "review" && review) {
    const m = review.report.measures;
    const num = (v: number | null, d = 0) => (v === null ? "–" : v.toFixed(d));
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: review.report.passed ? tc("title") : t("review.failTitle"), headerBackTitle: "Geri" }} />
        <Screen>
          <Card title={review.report.passed ? t("review.okTitle") : t("review.failTitle")} description={review.report.passed ? tc("body") : t(`issues.${review.report.issues[0] ?? "no_face"}`)}>
            <Image source={{ uri: review.image.uri }} accessibilityLabel={tc("previewAlt")} style={{ width: "100%", aspectRatio: review.image.width / review.image.height, borderRadius: radius.md }} resizeMode="contain" />
            {review.report.warnings[0] ? <Text variant="small">{t(`warnings.${review.report.warnings[0]}`)}</Text> : null}
            <Text variant="small">{tc("pose")}: {num(m.yaw)}° / {num(m.pitch)}° / {num(m.roll)}° · {tc("brightness")}: {num(m.brightness)} · {tc("sharpness")}: {num(m.sharpness)} · {tc("frames")}: {review.recent.length}</Text>
            {review.geometry ? (
              <Text variant="small">{tg("faceShape")}: {tg(`shapes.${review.geometry.faceShape.primary}`)} · {tg("fwhr")}: {review.geometry.metrics.fwhr.toFixed(2)}</Text>
            ) : review.report.passed ? (
              <Text variant="small">{tg("computing")}</Text>
            ) : null}
            {error ? (
              <Text accessibilityRole="alert" style={{ color: colors.destructive }}>
                {ta(`errors.${error.code}`) === `analysis.errors.${error.code}` ? ta("errors.GENERIC") : ta(`errors.${error.code}`)}
                {error.retryAt ? ` ${ta("retryAt", { date: new Date(error.retryAt).toLocaleString("tr-TR") })}` : ""}
              </Text>
            ) : null}
            {review.report.passed && !forTryon ? <SwitchRow label={tc("saveProgress")} hint={tc("saveProgressHint")} value={saveProgress} onChange={setSaveProgress} /> : null}
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button title={t("review.retake")} variant="outline" style={{ flex: 1 }} onPress={retake} />
              {review.report.passed && forTryon ? <Button title={t("review.use")} style={{ flex: 1 }} onPress={() => void keepForTryon()} /> : null}
              {review.report.passed && !forTryon ? <Button title={ta("start")} style={{ flex: 1 }} disabled={!review.geometry || error?.code === "QUOTA_EXCEEDED"} onPress={submit} /> : null}
            </View>
            <Text variant="small">{tt("common.photoNotStored")}</Text>
          </Card>
        </Screen>
      </>
    );
  }

  if (stage === "guide" || stage === "denied" || stage === "model_error") {
    const key = stage === "denied" ? "denied" : stage === "model_error" ? "modelError" : "guide";
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: t("guide.title"), headerBackTitle: "Geri" }} />
        <Screen>
          <Card title={t(`${key}.title`)} description={t(`${key}.body`)}>
            {stage === "guide" ? (
              <View style={{ gap: spacing.xs }}>
                {(["light", "neutral", "frame", "alone"] as const).map((k) => (
                  <Text key={k} variant="muted">• {t(`guide.tips.${k}`)}</Text>
                ))}
              </View>
            ) : null}
            {issue ? <Text accessibilityLiveRegion="polite">{issue}</Text> : null}
            {stage !== "denied" ? <Button title={t("guide.open")} size="lg" onPress={startCamera} disabled={stage === "model_error"} /> : null}
            <Button title={t("guide.upload")} size="lg" variant={stage === "denied" ? "primary" : "outline"} onPress={pickFromGallery} />
            {stage === "model_error" ? <Button title={t("modelError.retry")} variant="ghost" onPress={() => go("guide")} /> : null}
            <Text variant="small">{t("guide.privacy")}</Text>
          </Card>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t("guide.title"), headerBackTitle: "Geri" }} />
      <Screen scroll={false} style={{ alignItems: "center" }}>
        <View style={{ width: camW, height: camH, borderRadius: 24, overflow: "hidden", backgroundColor: "#000" }}>
          <MediapipeCamera ref={cameraRef} style={{ width: camW, height: camH }} solution={solution} activeCamera="front" resizeMode="cover" />
          <OvalOverlay dashed={Boolean(issue)} width={camW} height={camH} />
          {stage === "countdown" ? (
            <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }} accessibilityLiveRegion="assertive">
              <Text style={{ fontSize: 72, color: "#fff", fontWeight: "600" }}>{countdown || 1}</Text>
            </View>
          ) : null}
          {stage === "processing" ? (
            <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)" }}>
              <Text style={{ color: "#fff" }}>{t("live.processing")}</Text>
            </View>
          ) : null}
        </View>
        <Text accessibilityLiveRegion="polite" variant={issue ? "body" : "muted"} style={{ textAlign: "center", minHeight: 24 }}>
          {issue ?? warning ?? (stage === "countdown" ? t("live.holdStill") : t("live.ready"))}
        </Text>
        <Button title={t("live.cancel")} variant="ghost" onPress={() => go("guide")} />
      </Screen>
    </>
  );
}
