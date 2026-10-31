import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { PaywallProvider } from "@/components/paywall/PaywallSheet";
import { PlanLocked } from "@/components/report/PlanLocked";
import { ReportView } from "@/components/report/ReportView";
import { getPremiumStatus } from "@/lib/api/premium";
import { CoachReport } from "@/lib/ai/reportSchema";
import { planBasis, planSkips } from "@/lib/coach/planBasis";
import { getLatestReport } from "@/lib/coach/reportsStore";
import { isFeatureEnabled } from "@/lib/config/flags";
import { getTeaserConfig } from "@/lib/config/teaser";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { QuestionnaireSchema } from "@/lib/questionnaire";
import { toClientAnalysis, type AnalysisRow } from "@/lib/score/present";
import { selectAnalysisRows } from "@/lib/score/rowColumns";
import type { ImproveItem } from "@/lib/score/contract";

/** /plan/[analysisId]: koç raporu (premium) ve dayandığı anket cevapları (UI spec §7). Rapor yoksa istemci ilk açılışta üretir. */
export default async function PlanPage({ params }: PageProps<"/plan/[analysisId]">) {
  const { analysisId } = await params;
  if (!z.uuid().safeParse(analysisId).success) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  // analyses tarayıcıya kapalı: admin istemcisi + user_id ile sahiplik.
  const admin = createAdminClient();
  const { data: a } = await admin.from("analyses").select("id, status").eq("id", analysisId).eq("user_id", user.id).maybeSingle();
  if (!a) notFound();
  const [t, { premium }, profile] = await Promise.all([
    getTranslations("report"),
    getPremiumStatus(supabase, user.id),
    supabase.from("profiles").select("questionnaire, updated_at").eq("id", user.id).maybeSingle(),
  ]);
  // Beden ve serbest not yalnız sunucu kurallarında kullanılır; buradan yalnız çip ve atlama bilgisi türetilir.
  const q = QuestionnaireSchema.safeParse(profile.data?.questionnaire);
  const skipped = q.success ? planSkips(q.data) : {};
  const teaser = getTeaserConfig();

  if (!premium) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <PaywallProvider teaserMode={teaser.mode} analysisId={analysisId} weekPassEnabled={isFeatureEnabled("weekPass")}>
          <PlanLocked skipped={skipped} />
        </PaywallProvider>
      </div>
    );
  }

  const stored = await getLatestReport(user.id, analysisId);
  const parsed = stored ? CoachReport.safeParse(stored.report) : null;
  const initial = stored && parsed?.success ? { reportId: stored.id, report: parsed.data, isFallback: stored.isFallback } : null;
  const improveFirst = await loadImproveFirst(admin, analysisId, user.id, teaser);
  const updatedAt = typeof profile.data?.updated_at === "string" ? Date.parse(profile.data.updated_at) : NaN;
  const basisStale = Boolean(stored) && !Number.isNaN(updatedAt) && updatedAt > Date.parse(stored?.createdAt ?? "");

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <ReportView
        analysisId={analysisId}
        initial={initial}
        expertNetworkEnabled={isFeatureEnabled("expertNetwork")}
        basis={q.success ? planBasis(q.data) : undefined}
        improveFirst={improveFirst}
        skipped={skipped}
        basisStale={basisStale}
      />
    </div>
  );
}

/**
 * Öncelik sırası (premium): satır ANALYSIS_ROW_COLUMNS ile okunur (0009 yoksa eski listeyle), improveFirst toClientAnalysis'ten gelir.
 * Migration 0009 uygulanmamış ortamda yeni sütunlar yoktur; sorgu hata verirse öncelik listesi gösterilmez.
 */
async function loadImproveFirst(
  admin: ReturnType<typeof createAdminClient>,
  analysisId: string,
  userId: string,
  teaser: ReturnType<typeof getTeaserConfig>,
): Promise<ImproveItem[] | null> {
  const { data, error } = await selectAnalysisRows((cols) => admin.from("analyses").select(cols).eq("id", analysisId).eq("user_id", userId).maybeSingle());
  if (error || !data) return null;
  const row = data as AnalysisRow;
  if (row.status !== "completed") return null;
  const v = toClientAnalysis(row, true, teaser.mode, teaser.subscore).improveFirst;
  return v.locked ? null : v.value;
}
