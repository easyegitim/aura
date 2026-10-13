import { Stack } from "expo-router";
import { Screen } from "@/mobile/src/components/ui/Screen";
import { Text } from "@/mobile/src/components/ui/Text";
import { scoped } from "@/mobile/src/lib/i18n";

const t = scoped("paywall");

/** M3 yer tutucu; RevenueCat paywall M4'te. Uygulama içinden web ödemesine yönlendirme yok (SPEC 15.4). */
export default function PremiumScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t("pageTitle"), headerBackTitle: "Geri" }} />
      <Screen>
        <Text variant="heading" accessibilityRole="header">{t("pageTitle")}</Text>
        <Text variant="muted">{t("pageBody")}</Text>
      </Screen>
    </>
  );
}
