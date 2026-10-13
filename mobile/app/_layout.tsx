import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AnalyticsProvider } from "@/mobile/src/features/analytics/AnalyticsProvider";
import { SessionProvider } from "@/mobile/src/features/session/SessionProvider";
import { initMonitoring, wrapRoot } from "@/mobile/src/lib/monitoring";
import { useTheme } from "@/mobile/src/theme";

initMonitoring();

function Root() {
  const { colors, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="hesap" options={{ headerShown: true, title: "Hesap", headerBackTitle: "Geri" }} />
      </Stack>
    </>
  );
}

/** Kök düzen: güvenli alan, oturum sağlayıcı, analitik (izinle), tema. Kapılar (tabs) ve onboarding düzenlerinde. */
function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <AnalyticsProvider />
        <Root />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

export default wrapRoot(RootLayout);
