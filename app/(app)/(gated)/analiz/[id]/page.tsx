import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { ScoreView } from "@/components/analysis/ScoreView";
import { PaywallProvider } from "@/components/paywall/PaywallSheet";
import { getPremiumStatus } from "@/lib/api/premium";
import { getTeaserConfig } from "@/lib/config/teaser";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { toClientAnalysis, type AnalysisRow } from "@/lib/score/present";

/** /analiz/[id]: sunucu kırpılmış görünümü üretir; kilitli değerler HTML'e ve istemciye girmez. */
export default async function AnalysisPage({ params }: PageProps<"/analiz/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const admin = createAdminClient();
  const { data } = await admin
    .from("analyses")
    .select("id, status, created_at, face_shape, overall, potential, subscores, gains, observations, geometry, calibration_version")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) notFound();

  const t = await getTranslations("analysis");
  const row = data as AnalysisRow;
  if (row.status !== "completed") {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <p className="rounded-md border px-3 py-2 text-sm">{row.status === "failed" ? t("statusFailed") : t("statusProcessing")}</p>
      </div>
    );
  }
  const { premium } = await getPremiumStatus(supabase, user.id);
  const teaser = getTeaserConfig();
  const a = toClientAnalysis(row, premium, teaser.mode, teaser.subscore);
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <PaywallProvider teaserMode={teaser.mode}>
        <ScoreView a={a} premium={premium} />
      </PaywallProvider>
    </div>
  );
}
