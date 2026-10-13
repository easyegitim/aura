import { Stack } from "expo-router";
import { isFeatureEnabled } from "@/lib/config/flags";
import { Screen } from "@/mobile/src/components/ui/Screen";
import { Text } from "@/mobile/src/components/ui/Text";
import { scoped } from "@/mobile/src/lib/i18n";

const t = scoped("experts");

/** M5 yer tutucu; Uzman Ağı dizini M8'de. Flag kapalıysa içerik yok (SPEC 12.2). */
export default function ExpertsScreen() {
  const enabled = isFeatureEnabled("expertNetwork");
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t("title"), headerBackTitle: "Geri" }} />
      <Screen>
        <Text variant="muted">{enabled ? "…" : t("disabled")}</Text>
      </Screen>
    </>
  );
}
