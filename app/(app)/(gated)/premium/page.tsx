import { ArrowLeft, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutFlow } from "@/components/billing/CheckoutFlow";
import { getPremiumStatus } from "@/lib/api/premium";
import { isUuid } from "@/lib/billing/returnAnalysis";
import { isFeatureEnabled } from "@/lib/config/flags";
import { DEFAULT_PLAN_ID, SUBSCRIPTION_PLAN_IDS, type SubscriptionPlanId } from "@/lib/config/plans";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";

/** /premium (F14): planlar, hesap bağlama, fatura formu, iki onay, iyzico formu. `analysis` ile aynı analize dönülür (UI spec §4.2). */
export default async function PremiumPage({ searchParams }: PageProps<"/premium">) {
  const { plan, analysis } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const [t, tc, { premium }] = await Promise.all([getTranslations("paywall"), getTranslations("checkout"), getPremiumStatus(supabase, user.id)]);
  const weekPass = isFeatureEnabled("weekPass");
  const initial = typeof plan === "string" && ((SUBSCRIPTION_PLAN_IDS as readonly string[]).includes(plan) || (plan === "week_pass" && weekPass)) ? (plan as SubscriptionPlanId | "week_pass") : DEFAULT_PLAN_ID;

  // analyses tarayıcıya kapalı (RLS okuma politikası yok): sahiplik admin istemcisi + user_id ile doğrulanır; değilse yok sayılır.
  let analysisId: string | undefined;
  if (isUuid(analysis)) {
    const { data } = await createAdminClient().from("analyses").select("id").eq("id", analysis).eq("user_id", user.id).eq("status", "completed").maybeSingle();
    if (data) analysisId = analysis;
  }
  if (premium && analysisId) redirect(`/analiz/${analysisId}`);

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 px-4 py-6">
      {analysisId ? (
        <Link href={`/analiz/${analysisId}`} className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("backToAnalysis")}
        </Link>
      ) : null}
      {/* Premium kullanıcıya satın alma başlığı ve ödeme rozeti gösterilmez; CheckoutFlow "Zaten premiumsun" kartını (h1) çizer. */}
      {premium ? null : (
        <header className="space-y-2">
          <p className="eyebrow text-brand">{t("eyebrow")}</p>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("pageLead")}</p>
          <p className="inline-flex h-6 items-center gap-1.5 rounded-full bg-muted px-2.5 text-[11px] font-medium">
            <ShieldCheck aria-hidden="true" className="size-3.5 text-success" />
            {tc("secure")}
          </p>
        </header>
      )}
      <CheckoutFlow isAnonymous={user.is_anonymous ?? false} initialPlan={initial} weekPassEnabled={weekPass} alreadyPremium={premium} analysisId={analysisId} />
    </div>
  );
}
