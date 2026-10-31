import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, View } from "react-native";
import { BEARD_PRESETS } from "@/content/beard-presets";
import { COLOR_PRESETS } from "@/content/color-presets";
import { HAIR_PRESETS } from "@/content/hair-presets";
import { getPreset } from "@/content/presets";
import type { Preset } from "@/content/types";
import { track } from "@/lib/analytics";
import { TRYON_IMAGE_MAX_BYTES } from "@/lib/api/tryonInput";
import { landmarksToCrop } from "@/lib/face/crop";
import { FeedbackButtons } from "@/mobile/src/components/report/FeedbackButtons";
import { Button } from "@/mobile/src/components/ui/Button";
import { Card } from "@/mobile/src/components/ui/Card";
import { Screen } from "@/mobile/src/components/ui/Screen";
import { Text } from "@/mobile/src/components/ui/Text";
import { getSessionSelfie } from "@/mobile/src/features/capture/sessionSelfie";
import { useSession } from "@/mobile/src/features/session/SessionProvider";
import { ApiClientError } from "@/mobile/src/lib/api";
import { scoped, t as tt } from "@/mobile/src/lib/i18n";
import { cropSquareBase64, deleteQuietly } from "@/mobile/src/native/images";
import { driftPolicyFor } from "@/lib/tryon/composite";
import { compositeTryonNative, stampAiLabelBase64 } from "@/mobile/src/native/tryon";
import { shareBase64Jpeg } from "@/mobile/src/features/share/renderCard";
import { radius, spacing, useTheme } from "@/mobile/src/theme";

const t = scoped("tryon");
type Kind = "hair" | "beard" | "color" | "recommended";
type Stage = "gallery" | "generating" | "result";
type Status = { premium: boolean; hasConsent: boolean; consentVersion: string; recommended: string[]; quota: { used: number; limit: number; nextAt: string | null } | null; presentation: "male" | "female" | "unspecified" };
const CROP_SIZE = 1024;
/** Süre ölçümü (olay işleyicilerinde; modül düzeyinde tanımlı — React saflık kuralı). */
const epochNow = () => Date.now();

function newRequestId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => { const r = (Math.random() * 16) | 0; return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16); });
}

/** /dene (F11 mobil): stil galerisi → (rıza) → bellekteki selfie → POST /api/tryon → Skia kompoziti → önce/sonra. */
export default function TryonTab() {
  const { colors } = useTheme();
  const { api } = useSession();
  const { preset: initialPreset } = useLocalSearchParams<{ preset?: string }>();
  const [status, setStatus] = useState<Status | null>(null);
  const [tab, setTab] = useState<Kind>("hair");
  const [stage, setStage] = useState<Stage>("gallery");
  const [pending, setPending] = useState<Preset | null>(null);
  const [used, setUsed] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ eventId: string; preset: Preset; beforeUri: string; afterUri: string } | null>(null);
  const [view, setView] = useState<"before" | "after">("after");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void api.get<Status>("/api/tryon/status").then((s) => {
        if (!active || !s) return;
        setStatus(s);
        setUsed(s.quota?.used ?? 0);
        if (s.recommended.length) setTab("recommended");
        if (initialPreset) {
          const p = getPreset(initialPreset);
          if (p) setPending(p);
        }
      }).catch(() => active && setStatus(null));
      return () => {
        active = false;
      };
    }, [api, initialPreset]),
  );

  const presentation = status?.presentation ?? "unspecified";
  const recommended = useMemo(() => status?.recommended ?? [], [status]);
  const list = useMemo(() => {
    const byPres = (p: Preset) => !p.presentation || presentation === "unspecified" || p.presentation.includes(presentation);
    if (tab === "recommended") return recommended.map(getPreset).filter((p): p is Preset => Boolean(p));
    if (tab === "hair") return HAIR_PRESETS.filter(byPres);
    if (tab === "beard") return BEARD_PRESETS;
    return COLOR_PRESETS;
  }, [tab, recommended, presentation]);

  async function giveConsent() {
    if (!status) return;
    try {
      await api.post("/api/consents", { type: "tryon_generation", granted: true, textVersion: status.consentVersion });
      track("consent_updated", { type: "tryon_generation", granted: true });
      setStatus({ ...status, hasConsent: true });
    } catch {
      Alert.alert(t("consentError"));
    }
  }

  function choose(p: Preset) {
    setPending(p);
    setError(null);
    if (!getSessionSelfie()) {
      router.push({ pathname: "/tara", params: { purpose: "tryon" } });
      return;
    }
    void run(p);
  }

  async function run(preset: Preset) {
    const selfie = getSessionSelfie();
    if (!selfie) return;
    setStage("generating");
    setElapsed(0);
    const start = epochNow();
    timerRef.current = setInterval(() => setElapsed(Math.round((epochNow() - start) / 1000)), 1000);
    track("tryon_started", { presetKind: preset.kind });
    let cUri: string | null = null;
    let eventId: string | null = null;
    try {
      // 1024 px kare kırpım C + kırpım uzayında landmark'lar (SPEC 10.3 adım 4)
      const crop = await cropSquareBase64(selfie.uri, selfie.landmarksPx, selfie.width, selfie.height, CROP_SIZE, TRYON_IMAGE_MAX_BYTES, 0.9);
      cUri = crop.uri;
      const landmarksC = landmarksToCrop(selfie.landmarksPx, crop.box, CROP_SIZE);
      const res = await api.post<{ eventId: string; image: string; mimeType: string }>("/api/tryon", { clientRequestId: newRequestId(), presetId: preset.id, image: crop.base64 });
      if (!res) throw new Error("empty");
      eventId = res.eventId;
      const out = await compositeTryonNative(cUri, landmarksC, res.image, preset.protect, driftPolicyFor(preset));
      if (!out.ok) {
        await api.post(`/api/tryon/${eventId}/drift`, {}).catch(() => undefined);
        track("tryon_result", { status: "identity_drift", durationMs: epochNow() - start });
        setError(t("driftMessage"));
        setStage("gallery");
        await deleteQuietly(cUri);
        return;
      }
      setResult({ eventId, preset, beforeUri: cUri, afterUri: out.uri });
      setUsed((u) => u + 1);
      track("tryon_result", { status: "success", durationMs: epochNow() - start });
      setStage("result");
    } catch (e) {
      const code = e instanceof ApiClientError ? e.code : "NETWORK";
      track("tryon_result", { status: code, durationMs: epochNow() - start });
      setError(t(`errors.${code}`) === `tryon.errors.${code}` ? t("errors.GENERIC") : t(`errors.${code}`));
      setStage("gallery");
      await deleteQuietly(cUri);
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }

  async function download() {
    if (!result) return;
    try {
      const b64 = await stampAiLabelBase64(result.afterUri, tt("common.aiGenerated"));
      await shareBase64Jpeg(b64, result.preset.nameTr);
    } catch {
      Alert.alert(t("errors.GENERIC"));
    }
  }

  async function back() {
    if (result) {
      await deleteQuietly(result.beforeUri);
      await deleteQuietly(result.afterUri);
    }
    setResult(null);
    setStage("gallery");
  }

  if (!status) return <Screen><Text variant="muted">…</Text></Screen>;
  if (!status.premium) {
    return (
      <Screen>
        <Card title={t("lockedTitle")} description={t("lockedBody")}>
          <Button title={t("goPremium")} onPress={() => router.push("/premium")} />
        </Card>
      </Screen>
    );
  }
  if (!status.hasConsent) {
    return (
      <Screen>
        <Card title={t("consent.title")} description={t("consent.body")}>
          {(["b1", "b2", "b3", "b4"] as const).map((k) => <Text key={k} variant="muted">• {t(`consent.${k}`)}</Text>)}
          <Button title={t("consent.accept")} size="lg" onPress={giveConsent} />
        </Card>
      </Screen>
    );
  }
  if (stage === "generating") {
    return (
      <Screen>
        <Card title={t("generating.title", { name: pending?.nameTr ?? "" })} description={elapsed > 45 ? t("generating.slow") : t("generating.body")}>
          <Text variant="muted">{t("generating.elapsed", { s: elapsed })}</Text>
        </Card>
      </Screen>
    );
  }
  if (stage === "result" && result) {
    return (
      <Screen>
        <View style={{ borderRadius: 24, overflow: "hidden", backgroundColor: "#000" }}>
          <Image source={{ uri: view === "after" ? result.afterUri : result.beforeUri }} style={{ width: "100%", aspectRatio: 1 }} accessibilityLabel={view === "after" ? t("afterAlt") : t("beforeAlt")} />
          <Text style={{ position: "absolute", right: 8, bottom: 8, color: "#fff", fontSize: 11, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 6, borderRadius: 4 }}>{tt("common.aiGenerated")}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button title={t("before")} variant={view === "before" ? "primary" : "outline"} style={{ flex: 1 }} onPress={() => setView("before")} />
          <Button title={t("after")} variant={view === "after" ? "primary" : "outline"} style={{ flex: 1 }} onPress={() => setView("after")} />
        </View>
        <Text style={{ textAlign: "center" }}>{result.preset.nameTr}</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button title={t("download")} variant="outline" style={{ flex: 1 }} onPress={download} />
          <Button title={t("tryAnother")} style={{ flex: 1 }} onPress={() => void back()} />
        </View>
        <FeedbackButtons targetType="tryon" targetId={result.eventId} />
        <Text variant="small">{t("resultNote")}</Text>
      </Screen>
    );
  }

  const limit = status.quota?.limit ?? 0;
  const remaining = Math.max(0, limit - used);
  const tabs: Kind[] = [...(recommended.length ? (["recommended"] as Kind[]) : []), "hair", "beard", "color"];
  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text variant="muted">{t("remaining", { n: remaining, limit })}</Text>
        {remaining === 0 && status.quota?.nextAt ? <Text variant="small">{t("nextAt", { date: new Date(status.quota.nextAt).toLocaleDateString("tr-TR") })}</Text> : null}
      </View>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text> : null}
      {!getSessionSelfie() ? <Text variant="small">{t("needSelfie")}</Text> : null}
      <View style={{ flexDirection: "row", gap: spacing.xs }}>
        {tabs.map((k) => (
          <Button key={k} title={t(`tabs.${k}`)} variant={tab === k ? "primary" : "outline"} style={{ flex: 1, minHeight: 40 }} onPress={() => setTab(k)} />
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {list.map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            disabled={remaining === 0}
            onPress={() => choose(p)}
            style={{ width: "48%", padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, opacity: remaining === 0 ? 0.5 : 1, gap: 2 }}
          >
            <Text style={{ fontWeight: "600" }}>{p.nameTr}</Text>
            {p.noteTr ? <Text variant="small">{p.noteTr}</Text> : null}
            {recommended.includes(p.id) ? <Text variant="small">★ {t("recommendedBadge")}</Text> : null}
          </Pressable>
        ))}
      </View>
      <Text variant="small">{t("galleryNote")}</Text>
    </Screen>
  );
}
