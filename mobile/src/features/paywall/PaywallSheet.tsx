import { router } from "expo-router";
import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { Modal, Pressable, View } from "react-native";
import { track } from "@/lib/analytics";
import { Button } from "@/mobile/src/components/ui/Button";
import { Text } from "@/mobile/src/components/ui/Text";
import { scoped } from "@/mobile/src/lib/i18n";
import { radius, spacing, useTheme } from "@/mobile/src/theme";

const t = scoped("paywall");
type Ctx = { open: (trigger: string) => void };
const PaywallCtx = createContext<Ctx>({ open: () => undefined });

/** SPEC 5.3 paywall sheet (mobil). Satın alma M4'te RevenueCat ile; buradan /premium'a gidilir. */
export function PaywallProvider({ children, teaserMode }: PropsWithChildren<{ teaserMode: string }>) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const value = useMemo<Ctx>(
    () => ({
      open: (trigger) => {
        track("paywall_viewed", { trigger, teaserMode });
        setVisible(true);
      },
    }),
    [teaserMode],
  );
  return (
    <PaywallCtx.Provider value={value}>
      {children}
      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={() => setVisible(false)} accessibilityLabel="Kapat" />
        <View style={{ backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
          <Text variant="heading" accessibilityRole="header">{t("title")}</Text>
          <Text variant="muted">{t("body")}</Text>
          <View style={{ gap: spacing.xs }}>
            {(["i1", "i2", "i3", "i4"] as const).map((k) => (
              <Text key={k}>• {t(`includes.${k}`)}</Text>
            ))}
          </View>
          <Button
            title={t("cta")}
            size="lg"
            onPress={() => {
              setVisible(false);
              router.push("/premium");
            }}
          />
          <Text variant="small">{t("note")}</Text>
        </View>
      </Modal>
    </PaywallCtx.Provider>
  );
}

export function usePaywall(): Ctx {
  return useContext(PaywallCtx);
}
