import { Screen } from "@/mobile/src/components/ui/Screen";
import { Text } from "@/mobile/src/components/ui/Text";
import { t } from "@/mobile/src/lib/i18n";

/** M1 yer tutucu; yaş/izinler/anket ekranları M2'de (paylaşılan şema ve metinlerle). */
export default function Onboarding_yas() {
  return (
    <Screen>
      <Text variant="heading" accessibilityRole="header">{t("placeholders.onboarding.title")}</Text>
      <Text variant="muted">{t("placeholders.onboarding.body")}</Text>
    </Screen>
  );
}
