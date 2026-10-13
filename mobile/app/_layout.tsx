import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/mobile/src/features/session/SessionProvider";
import { useTheme } from "@/mobile/src/theme";

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

/** Kök düzen (M1): güvenli alan, oturum sağlayıcı, tema. Kapılar (tabs) ve onboarding düzenlerinde. */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Root />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
