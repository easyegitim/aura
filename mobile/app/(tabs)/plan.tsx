import { Screen } from "@/mobile/src/components/ui/Screen";
import { Text } from "@/mobile/src/components/ui/Text";
import { t } from "@/mobile/src/lib/i18n";

/** M1 yer tutucu; gerçek ekran sonraki mobil fazda. */
export default function PlanTab() {
  return (
    <Screen>
      <Text variant="heading" accessibilityRole="header">{t("placeholders.plan.title")}</Text>
      <Text variant="muted">{t("placeholders.plan.body")}</Text>
    </Screen>
  );
}
