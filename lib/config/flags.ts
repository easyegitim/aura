// Özellik bayrakları (SPEC 2 D11, 5.1). Varsayılan kapalı; yalnız "true" açar.
export const FLAGS = {
  expertNetwork: "FEATURE_EXPERT_NETWORK",
  weekPass: "FEATURE_WEEK_PASS",
  /** Sağlayıcı adlarını arayüzde göster (UI spec §5.3). Hukuki onay (KVKK m.9, saklama) gelene kadar kapalı; kapalıyken "yapay zekâ". */
  providerNames: "FEATURE_PROVIDER_NAMES",
} as const;

export type FlagKey = keyof typeof FLAGS;

export function isFeatureEnabled(flag: FlagKey, env: Record<string, string | undefined> = process.env): boolean {
  return env[FLAGS[flag]]?.trim().toLowerCase() === "true";
}
