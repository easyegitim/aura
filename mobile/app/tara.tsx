import { Screen } from "@/mobile/src/components/ui/Screen";
import { Text } from "@/mobile/src/components/ui/Text";
import { t } from "@/mobile/src/lib/i18n";

/** M2 yer tutucu; kamera + MediaPipe + kalite kapısı M3'te. */
export default function CaptureScreen() {
  return (
    <Screen>
      <Text variant="heading" accessibilityRole="header">{t("placeholders.capture.title")}</Text>
      <Text variant="muted">{t("placeholders.capture.body")}</Text>
    </Screen>
  );
}
