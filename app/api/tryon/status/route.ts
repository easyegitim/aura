import { CoachReport } from "@/lib/ai/reportSchema";
import { getConsentState, withGuard } from "@/lib/api/guard";
import { getPremiumStatus } from "@/lib/api/premium";
import { CONSENT_DOC } from "@/lib/consent";
import { createAdminClient } from "@/lib/db/admin";
import { getLegalVersion } from "@/lib/legal/docs";
import { QuestionnaireSchema } from "@/lib/questionnaire";
import { tryonUsage } from "@/lib/tryon/quota";

export const runtime = "nodejs";

/**
 * SPEC-MOBILE M5: GET /api/tryon/status → { premium, hasConsent, consentVersion, recommended, quota, presentation }.
 * Web /dene sayfasının sunucu tarafı veri toplamasının API karşılığı; görsel içermez.
 */
export const GET = withGuard({}, async ({ user, supabase }) => {
  const { premium } = await getPremiumStatus(supabase, user.id);
  const consentVersion = await getLegalVersion(CONSENT_DOC.tryon_generation);
  const state = await getConsentState(supabase);
  const c = state.tryon_generation;
  const hasConsent = Boolean(c?.granted && c.textVersion === consentVersion);
  if (!premium) return Response.json({ premium: false, hasConsent, consentVersion, recommended: [], quota: null, presentation: "unspecified" });

  const admin = createAdminClient();
  const [usage, profile, report] = await Promise.all([
    tryonUsage(user.id),
    admin.from("profiles").select("questionnaire").eq("id", user.id).maybeSingle(),
    admin.from("coach_reports").select("report").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const q = QuestionnaireSchema.safeParse(profile.data?.questionnaire);
  const parsed = report.data ? CoachReport.safeParse(report.data.report) : null;
  const recommended = parsed?.success ? [...parsed.data.hair, ...parsed.data.beard, ...(parsed.data.hairColor ? [parsed.data.hairColor] : [])].map((p) => p.presetId) : [];
  return Response.json({
    premium: true,
    hasConsent,
    consentVersion,
    recommended,
    quota: { used: usage.used, limit: usage.limit, nextAt: usage.nextAt },
    presentation: q.success ? q.data.presentation : "unspecified",
  });
});
