import { router } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, View } from "react-native";
import { track } from "@/lib/analytics";
import { LEGAL_SLUGS } from "@/lib/consent";
import { Turnstile } from "@/mobile/src/components/Turnstile";
import { Button } from "@/mobile/src/components/ui/Button";
import { Screen } from "@/mobile/src/components/ui/Screen";
import { Text } from "@/mobile/src/components/ui/Text";
import { startAnonymousSession } from "@/mobile/src/features/auth/startAnonymousSession";
import { useSession } from "@/mobile/src/features/session/SessionProvider";
import { env } from "@/mobile/src/lib/env";
import { t } from "@/mobile/src/lib/i18n";
import { radius, spacing, useTheme } from "@/mobile/src/theme";

const ONBOARDING_START = "/baslangic/yas";

/** Açılış (SPEC 4.2 "/"): başlık, 3 adım, CTA, yasal linkler (web'de açılır). Fiyatlar ve SSS web sitesinde. */
export default function Landing() {
  const { colors } = useTheme();
  const { configured, user, loading } = useSession();
  const [captcha, setCaptcha] = useState(false);
  const [busy, setBusy] = useState(false);

  async function begin(token?: string) {
    setBusy(true);
    try {
      const r = await startAnonymousSession(token);
      setCaptcha(false);
      if (!r.ok) {
        Alert.alert(t("auth.sessionError"));
        return;
      }
      router.push(ONBOARDING_START);
    } finally {
      setBusy(false);
    }
  }

  function onStart() {
    track("landing_cta_clicked");
    if (!configured) {
      Alert.alert(t("auth.configError"));
      return;
    }
    if (user) {
      router.push("/(tabs)/analiz");
      return;
    }
    if (env.turnstileSiteKey) setCaptcha(true);
    else void begin();
  }

  const steps = ["s1", "s2", "s3"] as const;

  return (
    <Screen>
      <View style={{ gap: spacing.sm, paddingTop: spacing.lg }}>
        <Text variant="title" accessibilityRole="header">{t("landing.heroTitle")}</Text>
        <Text variant="muted">{t("landing.heroSubtitle")}</Text>
        <Text variant="small">{t("landing.heroNote")}</Text>
      </View>

      <Button title={loading ? t("common.loading") : t("common.startAnalysis")} size="lg" onPress={onStart} busy={busy} disabled={loading} />

      {captcha ? (
        <View style={{ gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg }}>
          <Text variant="heading">{t("auth.captchaTitle")}</Text>
          <Text variant="muted">{t("auth.captchaDescription")}</Text>
          <Turnstile onToken={(tok) => void begin(tok)} onError={() => Alert.alert(t("auth.captchaError"))} />
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Text variant="heading">{t("landing.howTitle")}</Text>
        {steps.map((s, i) => (
          <View key={s} style={{ flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg }}>
            <Text variant="heading">{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600" }}>{t(`landing.steps.${s}.title`)}</Text>
              <Text variant="muted">{t(`landing.steps.${s}.body`)}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ gap: spacing.xs, paddingBottom: spacing.xl }}>
        <Text variant="small">{t("common.adultOnly")} {t("common.photoNotStored")}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {LEGAL_SLUGS.map((slug) => (
            <Pressable key={slug} accessibilityRole="link" onPress={() => void Linking.openURL(`${env.apiUrl}/yasal/${slug}`)}>
              <Text variant="small" style={{ textDecorationLine: "underline" }}>{t(`legal.links.${slug}`)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}
