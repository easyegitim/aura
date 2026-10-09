import { getTranslations } from "next-intl/server";
import { LinkAccount } from "@/components/auth/LinkAccount";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { SubscriptionCard } from "@/components/billing/SubscriptionCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPremiumStatus } from "@/lib/api/premium";
import { createClient } from "@/lib/db/server";

export default async function AccountPage({ searchParams }: PageProps<"/hesap">) {
  const t = await getTranslations("account");
  const { auth_error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAnonymous = user?.is_anonymous ?? true;
  const sub = user ? await getPremiumStatus(supabase, user.id) : { premium: false, plan: null, periodEnd: null };
  const { data: subRow } = user ? await supabase.from("subscriptions").select("cancel_at_period_end").eq("user_id", user.id).maybeSingle() : { data: null };

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

      {auth_error ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {t("authError")}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isAnonymous ? t("anonymous") : t("emailLabel")}
            {isAnonymous ? <Badge variant="secondary">{t("anonymous")}</Badge> : null}
          </CardTitle>
          <CardDescription>{isAnonymous ? t("anonymousHint") : user?.email}</CardDescription>
        </CardHeader>
      </Card>

      {isAnonymous ? <LinkAccount returnPath="/hesap" /> : null}

      <SubscriptionCard premium={sub.premium} plan={sub.plan} periodEnd={sub.periodEnd} cancelAtPeriodEnd={Boolean(subRow?.cancel_at_period_end)} />

      <Card>
        <CardContent className="pt-4">
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}
