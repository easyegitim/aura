// app/globals.css ile aynı gri tonlu tema (oklch → yaklaşık sRGB). Açık/koyu, kontrast AA.
import { useColorScheme } from "react-native";

export type Palette = {
  background: string;
  foreground: string;
  card: string;
  primary: string;
  primaryForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  destructive: string;
  ring: string;
};

export const palettes: Record<"light" | "dark", Palette> = {
  light: {
    background: "#ffffff",
    foreground: "#0a0a0a",
    card: "#ffffff",
    primary: "#171717",
    primaryForeground: "#fafafa",
    muted: "#f5f5f5",
    mutedForeground: "#737373",
    border: "#e5e5e5",
    destructive: "#dc2626",
    ring: "#a3a3a3",
  },
  dark: {
    background: "#0a0a0a",
    foreground: "#fafafa",
    card: "#171717",
    primary: "#e5e5e5",
    primaryForeground: "#171717",
    muted: "#262626",
    mutedForeground: "#a3a3a3",
    border: "rgba(255,255,255,0.10)",
    destructive: "#ef4444",
    ring: "#737373",
  },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { md: 10, lg: 14, full: 999 } as const;

export function useTheme(): { colors: Palette; scheme: "light" | "dark" } {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return { colors: palettes[scheme], scheme };
}
