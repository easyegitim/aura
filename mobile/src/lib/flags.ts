// Mobil özellik bayrakları: Expo yalnız EXPO_PUBLIC_* değişkenlerini gömer; kural lib/config/flags.ts ile aynı ("true" açar).
// Sunucu her zaman son sözü söyler (FEATURE_EXPERT_NETWORK=false → /api/experts 404); bu bayrak yalnız UX içindir.
import { FLAGS, isFeatureEnabled, type FlagKey } from "@/lib/config/flags";

const MOBILE_FLAG_ENV: Record<FlagKey, string | undefined> = {
  expertNetwork: process.env.EXPO_PUBLIC_FEATURE_EXPERT_NETWORK,
  weekPass: process.env.EXPO_PUBLIC_FEATURE_WEEK_PASS,
  // Sağlayıcı adları hukuki onaya kadar kapalı (UI spec §5.3); mobilde gösterim parite sürümüyle gelir.
  providerNames: process.env.EXPO_PUBLIC_FEATURE_PROVIDER_NAMES,
};

export function isMobileFeatureEnabled(flag: FlagKey, overrides?: Partial<Record<FlagKey, string | undefined>>): boolean {
  const value = overrides && flag in overrides ? overrides[flag] : MOBILE_FLAG_ENV[flag];
  return isFeatureEnabled(flag, { [FLAGS[flag]]: value });
}
