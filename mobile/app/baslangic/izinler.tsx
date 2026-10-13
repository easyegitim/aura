import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { track } from "@/lib/analytics";
import { OPTIONAL_ONBOARDING_CONSENTS, REQUIRED_ANALYSIS_CONSENTS, type ConsentState, type ConsentType } from "@/lib/consent";
import { AGE_GATE_PATH, QUESTIONNAIRE_PATH } from "@/lib/onboarding/gate";
import { Button } from "@/mobile/src/components/ui/Button";
import { Card } from "@/mobile/src/components/ui/Card";
import { Screen } from "@/mobile/src/components/ui/Screen";
import { SwitchRow } from "@/mobile/src/components/ui/SwitchRow";
import { Text } from "@/mobile/src/components/ui/Text";
import { readConsentState, type LegalDocDto } from "@/mobile/src/features/onboarding/consents";
import { useSession } from "@/mobile/src/features/session/SessionProvider";
import { useGate } from "@/mobile/src/features/session/useGate";
import { scoped } from "@/mobile/src/lib/i18n";
import { getSupabase } from "@/mobile/src/lib/supabase";
import { radius, spacing, useTheme } from "@/mobile/src/theme";

const t = scoped("onboarding.consents");
type Key = (typeof REQUIRED_ANALYSIS_CONSENTS)[number] | (typeof OPTIONAL_ONBOARDING_CONSENTS)[number];
const KEYS: readonly Key[] = [...REQUIRED_ANALYSIS_CONSENTS, ...OPTIONAL_ONBOARDING_CONSENTS];

type Loaded = { notice: LegalDocDto; consentVersion: string; initial: ConsentState };

/** SPEC 4.1 adım 4 / 16.2: aydınlatma (sona kadar kaydır, "Okudum") → zorunlu üç rıza + pazarlama. Metinler /api/legal'dan. */
export default function ConsentsScreen() {
  const { colors } = useTheme();
  const { api } = useSession();
  const gate = useGate();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState<"notice" | "consents">("notice");
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [toggles, setToggles] = useState<Record<Key, boolean>>({ biometric_processing: false, photo_ai_analysis: false, cross_border_transfer: false, marketing: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([api.get<LegalDocDto>("/api/legal/aydinlatma"), api.get<LegalDocDto>("/api/legal/acik-riza"), readConsentState(getSupabase())])
      .then(([notice, consentDoc, initial]) => {
        if (!active || !notice || !consentDoc) return;
        const ack = initial.kvkk_notice_ack;
        const next = {} as Record<Key, boolean>;
        for (const k of KEYS) next[k] = Boolean(initial[k]?.granted && initial[k]?.textVersion === consentDoc.version);
        setToggles(next);
        setLoaded({ notice, consentVersion: consentDoc.version, initial });
        if (ack?.granted && ack.textVersion === notice.version) setStep("consents");
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [api]);

  if (gate.ready && gate.redirect === AGE_GATE_PATH) return <Redirect href={AGE_GATE_PATH} />;
  if (gate.ready && gate.redirect === "/") return <Redirect href="/" />;

  async function post(type: ConsentType, granted: boolean, textVersion: string) {
    await api.post("/api/consents", { type, granted, textVersion });
    track("consent_updated", { type, granted });
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 24) setScrolledToEnd(true);
  }

  async function ackNotice() {
    if (!loaded) return;
    setBusy(true);
    try {
      await post("kvkk_notice_ack", true, loaded.notice.version);
      setStep("consents");
    } catch {
      Alert.alert(t("error"));
    } finally {
      setBusy(false);
    }
  }

  const allRequired = REQUIRED_ANALYSIS_CONSENTS.every((k) => toggles[k]);

  async function saveConsents() {
    if (!loaded) return;
    setBusy(true);
    try {
      for (const k of KEYS) {
        const prev = loaded.initial[k];
        const unchanged = prev && prev.granted === toggles[k] && prev.textVersion === loaded.consentVersion;
        if (!unchanged && (toggles[k] || prev)) await post(k, toggles[k], loaded.consentVersion);
      }
      router.replace(QUESTIONNAIRE_PATH);
    } catch {
      Alert.alert(t("error"));
    } finally {
      setBusy(false);
    }
  }

  if (failed) {
    return (
      <Screen>
        <Card description={t("error")}>
          <Button title="Tekrar dene" variant="outline" onPress={() => { setFailed(false); setLoaded(null); }} />
        </Card>
      </Screen>
    );
  }
  if (!loaded) {
    return (
      <Screen>
        <Text variant="muted">…</Text>
      </Screen>
    );
  }

  if (step === "notice") {
    return (
      <Screen scroll={false}>
        <Card title={loaded.notice.title} description={t("noticeMeta", { version: loaded.notice.version, date: loaded.notice.updatedAt })} style={{ flex: 1 }}>
          <ScrollView
            onScroll={onScroll}
            scrollEventThrottle={64}
            onContentSizeChange={(_w, h) => h <= 400 && setScrolledToEnd(true)}
            style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm }}
          >
            <Text>{loaded.notice.body}</Text>
          </ScrollView>
          {!scrolledToEnd ? <Text variant="small">{t("scrollHint")}</Text> : null}
          <Button title={t("read")} size="lg" disabled={!scrolledToEnd} busy={busy} onPress={ackNotice} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card title={t("title")} description={t("description")}>
        <View style={{ gap: spacing.md }}>
          {KEYS.map((k) => {
            const required = (REQUIRED_ANALYSIS_CONSENTS as readonly string[]).includes(k);
            return (
              <SwitchRow
                key={k}
                label={`${t(`items.${k}.title`)} · ${required ? t("required") : t("optional")}`}
                hint={t(`items.${k}.body`)}
                value={toggles[k]}
                onChange={(v) => setToggles((s) => ({ ...s, [k]: v }))}
              />
            );
          })}
        </View>
        {!allRequired ? <Text variant="small">{t("missingRequired")}</Text> : null}
        <Text variant="small">{t("revokeNote")}</Text>
        <Button title={t("continue")} size="lg" disabled={!allRequired} busy={busy} onPress={saveConsents} />
      </Card>
    </Screen>
  );
}
