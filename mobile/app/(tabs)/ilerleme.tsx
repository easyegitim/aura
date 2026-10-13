import { Screen } from "@/mobile/src/components/ui/Screen";
import { Text } from "@/mobile/src/components/ui/Text";
import { t } from "@/mobile/src/lib/i18n";

/** M1 yer tutucu; gerçek ekran sonraki mobil fazda. */
export default function IlerlemeTab() {
  return (
    <Screen>
      <Text variant="heading" accessibilityRole="header">{t("placeholders.progress.title")}</Text>
      <Text variant="muted">{t("placeholders.progress.body")}</Text>
    </Screen>
  );
}
