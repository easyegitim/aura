import { Lock, ScanFace, Scissors, Timer, Wand2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TryonScreen } from "@/components/tryon/TryonScreen";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CoachReport } from "@/lib/ai/reportSchema";
import { getConsentState } from "@/lib/api/guard";
import { getPremiumStatus } from "@/lib/api/premium";
import { CONSENT_DOC } from "@/lib/consent";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { getLegalVersion } from "@/lib/legal/docs";
import { QuestionnaireSchema } from "@/lib/questionnaire";
import { tryonUsage } from "@/lib/tryon/quota";

const LOCKED_PERKS = [
  { k: "styles", icon: Scissors },
  { k: "face", icon: ScanFace },
  { k: "quota", icon: Timer },
] as const;

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
        <Card className="border-brand-gradient bg-hero-glow">
          <CardHeader className="items-center text-center">
            <span aria-hidden="true" className="mx-auto mb-1 grid size-14 place-items-center rounded-2xl bg-cta-gradient text-primary-foreground shadow-glow">
              <Wand2 className="size-7" />
            </span>
            <p className="eyebrow">{t("lockedEyebrow")}</p>
            <CardTitle className="text-2xl font-bold">{t("lockedTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid gap-2">
              {LOCKED_PERKS.map(({ k, icon: Icon }) => (
                <li key={k} className="flex min-h-12 items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-sm font-semibold">
                  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                    <Icon className="size-4" />
                  </span>
                  {t(`lockedPerks.${k}`)}
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="w-full">
              <Link href="/premium?from=tryon">
                <Lock aria-hidden="true" />
                {t("goPremium")}
              </Link>
            </Button>
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
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
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
