import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "@/mobile/src/features/session/SessionProvider";
import { useTheme } from "@/mobile/src/theme";

/** Onboarding grubu: oturum zorunlu (web (app)/layout karşılığı). Adım kapıları her ekranda (useGate). */
export default function OnboardingLayout() {
  const { colors } = useTheme();
  const { loading, user, configured } = useSession();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.foreground} />
      </View>
    );
  }
  if (!user || !configured) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
