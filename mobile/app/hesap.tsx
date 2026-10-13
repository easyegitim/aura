import { router } from "expo-router";
import { View } from "react-native";
import { Button } from "@/mobile/src/components/ui/Button";
import { Screen } from "@/mobile/src/components/ui/Screen";
import { Text } from "@/mobile/src/components/ui/Text";
import { useSession } from "@/mobile/src/features/session/SessionProvider";
import { t } from "@/mobile/src/lib/i18n";
import { spacing } from "@/mobile/src/theme";

/** M1: e-posta/anonim durumu ve çıkış. Plan, rızalar, export ve silme M7'de. */
export default function AccountScreen() {
  const { user, signOut } = useSession();
  const anonymous = user?.is_anonymous ?? true;
  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Text variant="heading" accessibilityRole="header">{anonymous ? t("account.anonymous") : t("account.emailLabel")}</Text>
        <Text variant="muted">{anonymous ? t("account.anonymousHint") : (user?.email ?? "")}</Text>
      </View>
      <Button
        title={t("auth.signOut")}
        variant="outline"
        onPress={async () => {
          await signOut();
          router.replace("/");
        }}
      />
    </Screen>
  );
}
