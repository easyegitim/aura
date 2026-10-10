import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TryonScreen } from "@/components/tryon/TryonScreen";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CoachReport } from "@/lib/ai/reportSchema";
import { getConsentState } from "@/lib/api/guard";
import { getPremiumStatus } from "@/lib/api/premium";
import { CONSENT_DOC } from "@/lib/consent";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { getLegalVersion } from "@/lib/legal/docs";
import { QuestionnaireSchema } from "@/lib/questionnaire";
import { tryonUsage } from "@/lib/tryon/quota";

/** /dene (F11): premium; ilk kullanımda tryon_generation rızası; "Sana önerilen" rapordan; kalan hak. */
export default async function TryonPage({ searchParams }: PageProps<"/dene">) {
  const { preset } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const [t, { premium }] = await Promise.all([getTranslations("tryon"), getPremiumStatus(supabase, user.id)]);

  if (!premium) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("lockedTitle")}</CardTitle>
            <CardDescription>{t("lockedBody")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full"><Link href="/premium?from=tryon">{t("goPremium")}</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const admin = createAdminClient();
  const [state, consentVersion, usage, profile, report] = await Promise.all([
    getConsentState(supabase),
    getLegalVersion(CONSENT_DOC.tryon_generation),
    tryonUsage(user.id),
    admin.from("profiles").select("questionnaire").eq("id", user.id).maybeSingle(),
    admin.from("coach_reports").select("report").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const c = state.tryon_generation;
  const hasConsent = Boolean(c?.granted && c.textVersion === consentVersion);
  const q = QuestionnaireSchema.safeParse(profile.data?.questionnaire);
  const parsed = report.data ? CoachReport.safeParse(report.data.report) : null;
  const recommended = parsed?.success ? [...parsed.data.hair, ...parsed.data.beard, ...(parsed.data.hairColor ? [parsed.data.hairColor] : [])].map((p) => p.presetId) : [];

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <TryonScreen
        consentVersion={consentVersion}
        hasConsent={hasConsent}
        recommended={recommended}
        quota={{ used: usage.used, limit: usage.limit, nextAt: usage.nextAt }}
        initialPreset={typeof preset === "string" ? preset : undefined}
        presentation={q.success ? q.data.presentation : "unspecified"}
      />
    </div>
  );
}
