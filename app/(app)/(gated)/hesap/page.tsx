import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ConsentSettings } from "@/components/account/ConsentSettings";
import { DataExportButton } from "@/components/account/DataExportButton";
import { DeleteAccountDialog } from "@/components/account/DeleteAccountDialog";
import { LinkAccount } from "@/components/auth/LinkAccount";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { SubscriptionCard } from "@/components/billing/SubscriptionCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MANAGEABLE_CONSENTS, type ManageableConsent } from "@/lib/account/consents";
import { getConsentState } from "@/lib/api/guard";
import { getPremiumStatus } from "@/lib/api/premium";
import { CONSENT_DOC, LEGAL_SLUGS } from "@/lib/consent";
import { createClient } from "@/lib/db/server";
import { getLegalVersion } from "@/lib/legal/docs";

/** F15: e-posta, plan ve iptal, rıza anahtarları (geri alma etkileriyle), verimi indir, hesabımı sil, çıkış. */
export default async function AccountPage({ searchParams }: PageProps<"/hesap">) {
  const t = await getTranslations("account");
  const tl = await getTranslations("legal");
  const { auth_error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAnonymous = user?.is_anonymous ?? true;
  const sub = user ? await getPremiumStatus(supabase, user.id) : { premium: false, plan: null, periodEnd: null };
  const { data: subRow } = user ? await supabase.from("subscriptions").select("cancel_at_period_end").eq("user_id", user.id).maybeSingle() : { data: null };
  const consentState = user ? await getConsentState(supabase) : {};
  const versions = Object.fromEntries(
    await Promise.all(MANAGEABLE_CONSENTS.map(async (k) => [k, await getLegalVersion(CONSENT_DOC[k])] as const)),
  ) as Record<ManageableConsent, string>;

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

      <ConsentSettings initial={consentState} versions={versions} />

      <DataExportButton />

      <Card>
        <CardHeader>
          <CardTitle>{t("legalTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1 text-sm">
            {LEGAL_SLUGS.map((s) => (
              <li key={s}>
                <Link className="underline underline-offset-4" href={`/yasal/${s}`}>{tl(`links.${s}`)}</Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <DeleteAccountDialog />

      <Card>
        <CardContent className="pt-4">
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}
