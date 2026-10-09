import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { CheckoutFlow } from "@/components/billing/CheckoutFlow";
import { getPremiumStatus } from "@/lib/api/premium";
import { isFeatureEnabled } from "@/lib/config/flags";
import { DEFAULT_PLAN_ID, SUBSCRIPTION_PLAN_IDS, type SubscriptionPlanId } from "@/lib/config/plans";
import { createClient } from "@/lib/db/server";

/** /premium (F14): planlar, hesap bağlama, fatura formu, iki onay, iyzico formu. */
export default async function PremiumPage({ searchParams }: PageProps<"/premium">) {
  const { plan } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const [t, { premium }] = await Promise.all([getTranslations("paywall"), getPremiumStatus(supabase, user.id)]);
  const weekPass = isFeatureEnabled("weekPass");
  const initial = typeof plan === "string" && ((SUBSCRIPTION_PLAN_IDS as readonly string[]).includes(plan) || (plan === "week_pass" && weekPass)) ? (plan as SubscriptionPlanId | "week_pass") : DEFAULT_PLAN_ID;

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("pageBody")}</p>
      <CheckoutFlow isAnonymous={user.is_anonymous ?? false} initialPlan={initial} weekPassEnabled={weekPass} alreadyPremium={premium} />
    </div>
  );
}
