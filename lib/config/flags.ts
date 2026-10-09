// Özellik bayrakları (SPEC 2 D11, 5.1). Varsayılan kapalı; yalnız "true" açar.
export const FLAGS = {
  expertNetwork: "FEATURE_EXPERT_NETWORK",
  weekPass: "FEATURE_WEEK_PASS",
} as const;

export type FlagKey = keyof typeof FLAGS;

export function isFeatureEnabled(flag: FlagKey, env: Record<string, string | undefined> = process.env): boolean {
  return env[FLAGS[flag]]?.trim().toLowerCase() === "true";
}
