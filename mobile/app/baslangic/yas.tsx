import { Redirect, router, type Href } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { track } from "@/lib/analytics";
import { AGE_GATE_PATH, CONSENTS_PATH } from "@/lib/onboarding/gate";
import { Button } from "@/mobile/src/components/ui/Button";
import { Card } from "@/mobile/src/components/ui/Card";
import { Input } from "@/mobile/src/components/ui/Input";
import { Screen } from "@/mobile/src/components/ui/Screen";
import { Text } from "@/mobile/src/components/ui/Text";
import { parseBirthYear } from "@/mobile/src/features/onboarding/age";
import { useSession } from "@/mobile/src/features/session/SessionProvider";
import { useGate } from "@/mobile/src/features/session/useGate";
import { scoped } from "@/mobile/src/lib/i18n";

const t = scoped("onboarding.age");

/** SPEC 4.1 adım 3: doğum yılı; 18 altı → engel ekranı; karar ve oturum kapatma sunucuda. */
export default function AgeGateScreen() {
  const { api, signOut } = useSession();
  const gate = useGate();
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  // Zaten 18+ işaretliyse (gate yaş kapısını istemiyorsa) izinlere geç.
  if (gate.ready && gate.redirect !== AGE_GATE_PATH && gate.redirect !== "/") return <Redirect href={(gate.redirect ?? CONSENTS_PATH) as Href} />;

  const parsed = parseBirthYear(year);

  async function submit() {
    if (!parsed) return;
    setBusy(true);
    try {
      const res = await api.post<{ isAdult: boolean }>("/api/onboarding/age", { birthYear: parsed });
      if (!res?.isAdult) {
        track("age_blocked");
        await signOut().catch(() => undefined);
        setBlocked(true);
        return;
      }
      router.replace(CONSENTS_PATH);
    } catch {
      Alert.alert(t("error"));
    } finally {
      setBusy(false);
    }
  }

  if (blocked) {
    return (
      <Screen>
        <Card title={t("blockedTitle")} description={t("blockedBody")}>
          <Button title={t("backHome")} variant="outline" onPress={() => router.replace("/")} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card title={t("title")} description={t("description")}>
        <Input label={t("label")} placeholder={t("placeholder")} value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} returnKeyType="done" onSubmitEditing={submit} />
        <Button title={t("continue")} size="lg" disabled={!parsed} busy={busy} onPress={submit} />
        <View>
          <Text variant="small">{t("note")}</Text>
        </View>
      </Card>
    </Screen>
  );
}
