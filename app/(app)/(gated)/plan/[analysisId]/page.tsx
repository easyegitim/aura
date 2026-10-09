import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { ReportView } from "@/components/report/ReportView";
import { getPremiumStatus } from "@/lib/api/premium";
import { CoachReport } from "@/lib/ai/reportSchema";
import { getLatestReport } from "@/lib/coach/reportsStore";
import { isFeatureEnabled } from "@/lib/config/flags";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { PaywallProvider } from "@/components/paywall/PaywallSheet";
import { getTeaserConfig } from "@/lib/config/teaser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** /plan/[analysisId]: koç raporu (premium). Rapor yoksa istemci ilk açılışta üretir. */
export default async function PlanPage({ params }: PageProps<"/plan/[analysisId]">) {
  const { analysisId } = await params;
  if (!z.uuid().safeParse(analysisId).success) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const admin = createAdminClient();
  const { data: a } = await admin.from("analyses").select("id, status").eq("id", analysisId).eq("user_id", user.id).maybeSingle();
  if (!a) notFound();
  const [t, { premium }] = await Promise.all([getTranslations("report"), getPremiumStatus(supabase, user.id)]);

  if (!premium) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <PaywallProvider teaserMode={getTeaserConfig().mode}>
          <Card>
            <CardHeader>
              <CardTitle>{t("lockedTitle")}</CardTitle>
              <CardDescription>{t("lockedBody")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full"><Link href="/premium?from=plan">{t("goPremium")}</Link></Button>
            </CardContent>
          </Card>
        </PaywallProvider>
      </div>
    );
  }

  const stored = await getLatestReport(user.id, analysisId);
  const parsed = stored ? CoachReport.safeParse(stored.report) : null;
  const initial = stored && parsed?.success ? { reportId: stored.id, report: parsed.data, isFallback: stored.isFallback } : null;

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <ReportView analysisId={analysisId} initial={initial} expertNetworkEnabled={isFeatureEnabled("expertNetwork")} />
    </div>
  );
}
