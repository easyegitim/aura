// SPEC 5.1 (KARAR) ve 5.2 (VARSAYILAN). Fiyatlar KDV dahil TL.
export const PLANS = {
  weekly: { priceTry: 250, iyzicoInterval: "WEEKLY", envRef: "IYZICO_PLAN_WEEKLY_REF" },
  monthly: { priceTry: 750, iyzicoInterval: "MONTHLY", envRef: "IYZICO_PLAN_MONTHLY_REF" },
  yearly: { priceTry: 8750, iyzicoInterval: "YEARLY", envRef: "IYZICO_PLAN_YEARLY_REF" },
  week_pass: { priceTry: 250, oneTimeDays: 7, featureFlag: "FEATURE_WEEK_PASS" },
} as const;

export const ENTITLEMENTS = {
  free: { analysesLifetime: 1, tryonsPerWindow: 0, reportRegens: 0 },
  premium: { analysesPerWindow: 1, tryonsPerWindow: 10, reportRegens: 2, windowDays: 7 },
} as const;

export type PlanId = keyof typeof PLANS;
export type SubscriptionPlanId = Exclude<PlanId, "week_pass">;

/** Abonelik planları, arayüzdeki gösterim sırasıyla. */
export const SUBSCRIPTION_PLAN_IDS = ["weekly", "monthly", "yearly"] as const satisfies readonly SubscriptionPlanId[];

/** Paywall'da önceden seçili plan (SPEC 15.2). */
export const DEFAULT_PLAN_ID: SubscriptionPlanId = "yearly";

const WEEKS_PER_PERIOD: Record<SubscriptionPlanId, number> = {
  weekly: 1,
  monthly: 52 / 12,
  yearly: 52,
};

/** Haftalık eşdeğer fiyat (SPEC 5.1 tablosu), tam sayıya yuvarlanır. */
export function weeklyEquivalentTry(plan: SubscriptionPlanId): number {
  return Math.round(PLANS[plan].priceTry / WEEKS_PER_PERIOD[plan]);
}

export function formatTry(amount: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(amount);
}
