import { Screen } from "@/mobile/src/components/ui/Screen";
import { Text } from "@/mobile/src/components/ui/Text";
import { t } from "@/mobile/src/lib/i18n";

/** Silme talebi bekleyen hesap (M7'de iptal akışı). Kapı buraya yönlendirir. */
export default function DeletionPending() {
  return (
    <Screen>
      <Text variant="heading" accessibilityRole="header">{t("deletion.title")}</Text>
      <Text variant="muted">{t("deletion.keepHint")}</Text>
    </Screen>
  );
}
