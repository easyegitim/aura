// SPEC 15.2. Tarayıcıdan gelen hiçbir bilgi premium açmaz; yalnız subscriptions satırı.
export function isPremium(sub?: { status: string; current_period_end: string | null } | null, now: Date = new Date()): boolean {
  if (!sub?.current_period_end) return false;
  return ["active", "past_due"].includes(sub.status) && new Date(sub.current_period_end) > now;
}

/** Test hesapları (profiles.unlimited_quota) için fiilen sınırsız limit; SQL fonksiyonları int bekler. */
export const UNLIMITED_LIMIT = 1_000_000;

export function effectiveLimit(base: number, unlimited: boolean): number {
  return unlimited ? UNLIMITED_LIMIT : base;
}
