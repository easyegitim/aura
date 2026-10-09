// SPEC 15.2. Tarayıcıdan gelen hiçbir bilgi premium açmaz; yalnız subscriptions satırı.
export function isPremium(sub?: { status: string; current_period_end: string | null } | null): boolean {
  if (!sub?.current_period_end) return false;
  return ["active", "past_due"].includes(sub.status) && new Date(sub.current_period_end) > new Date();
}
