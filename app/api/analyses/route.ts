import { ApiError } from "@/lib/api/errors";
import { withGuard } from "@/lib/api/guard";
import { AnalysisInput, decodeJpeg } from "@/lib/api/analysesInput";
import { getPremiumStatus } from "@/lib/api/premium";
import { ENTITLEMENTS } from "@/lib/config/plans";
import { getTeaserConfig } from "@/lib/config/teaser";
import { REQUIRED_ANALYSIS_CONSENTS } from "@/lib/consent";
import { createAdminClient } from "@/lib/db/admin";
import { QuestionnaireSchema, deriveContext } from "@/lib/questionnaire";
import { toClientAnalysis, toClientSummary, type AnalysisRow } from "@/lib/score/present";
import { scoreImage } from "@/lib/score/service";

export const runtime = "nodejs";
export const maxDuration = 60;

const ROW_COLUMNS = "id, status, created_at, face_shape, overall, potential, subscores, gains, observations, geometry, calibration_version";

/**
 * SPEC 14: POST /api/analyses { clientRequestId, geometry, image } → ClientAnalysis.
 * Sıra: oturum → Zod → 18+ → 3 rıza → JPEG imza/boyut → reserve_analysis (kota + idempotency) → skorlama → satır.
 * Görsel bellekte işlenir, AI sağlayıcısına iletilir, hiçbir yere yazılmaz/loglanmaz.
 */
export const POST = withGuard(
  { schema: AnalysisInput, requireAdult: true, requireConsents: REQUIRED_ANALYSIS_CONSENTS },
  async ({ user, supabase, input }) => {
    const decoded = decodeJpeg(input.image);
    if ("error" in decoded) {
      throw new ApiError(decoded.error, decoded.error === "IMAGE_TOO_LARGE" ? "Görsel 600 KB'ı aşıyor." : "Görsel JPEG değil.");
    }

    const admin = createAdminClient();
    const { premium } = await getPremiumStatus(supabase, user.id);
    const window = premium ? ENTITLEMENTS.premium : null;
    const limit = premium ? ENTITLEMENTS.premium.analysesPerWindow : ENTITLEMENTS.free.analysesLifetime;
    const since = window ? new Date(Date.now() - window.windowDays * 86_400_000).toISOString() : "-infinity";

    const { data: reservedId, error: rpcError } = await admin.rpc("reserve_analysis", {
      p_user: user.id,
      p_client_request_id: input.clientRequestId,
      p_limit: limit,
      p_since: since,
    });
    if (rpcError) throw new Error("reserve_analysis failed");

    const teaser = getTeaserConfig();
    if (!reservedId) {
      let retryAt: string | undefined;
      if (window) {
        const { data: last } = await admin
          .from("analyses")
          .select("created_at")
          .eq("user_id", user.id)
          .in("status", ["processing", "completed"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (last) retryAt = new Date(new Date(String(last.created_at)).getTime() + window.windowDays * 86_400_000).toISOString();
      }
      throw new ApiError("QUOTA_EXCEEDED", premium ? "Yeni analiz hakkın henüz açılmadı." : "Ücretsiz analiz hakkın kullanıldı.", retryAt);
    }

    // Idempotency: aynı clientRequestId ile önceden tamamlanmış satır varsa onu döndür.
    const { data: existing } = await admin.from("analyses").select(ROW_COLUMNS).eq("id", reservedId).single();
    if (existing && existing.status !== "processing") {
      return Response.json(toClientAnalysis(existing as AnalysisRow, premium, teaser.mode, teaser.subscore));
    }

    const { data: profile } = await admin.from("profiles").select("questionnaire").eq("id", user.id).maybeSingle();
    const q = QuestionnaireSchema.safeParse(profile?.questionnaire);
    const presentation = q.success ? q.data.presentation : "unspecified";
    const context = q.success ? deriveContext(q.data) : { bmi: null, bodyFatContextAllowed: false, exerciseEligible: false };
    const beardOption = q.success ? q.data.beardPreference !== "none" : false;

    try {
      const scored = await scoreImage(input.image, input.geometry, {
        presentation,
        bodyFatContextAllowed: context.bodyFatContextAllowed,
        beardOption,
      });
      const { data: row, error } = await admin
        .from("analyses")
        .update({
          status: "completed",
          geometry: input.geometry,
          face_shape: input.geometry.faceShape.primary,
          subscores: scored.subscores,
          gains: scored.gains,
          observations: scored.observations,
          flags: scored.flags,
          raw_overall: scored.rawOverall,
          overall: scored.overall,
          potential: scored.potential,
          calibration_version: scored.calibrationVersion,
          scoring_model: scored.model,
          prompt_version: scored.promptVersion,
          completed_at: new Date().toISOString(),
        })
        .eq("id", reservedId)
        .select(ROW_COLUMNS)
        .single();
      if (error || !row) throw new Error("analysis update failed");
      return Response.json(toClientAnalysis(row as AnalysisRow, premium, teaser.mode, teaser.subscore));
    } catch (e) {
      // Başarısız satır kotaya sayılmaz (reserve_analysis yalnız processing/completed sayar).
      await admin.from("analyses").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", reservedId);
      throw e;
    }
  },
);

/** GET /api/analyses → ClientAnalysisSummary[] (ücretsizde skorlar null). */
export const GET = withGuard({}, async ({ user, supabase }) => {
  const admin = createAdminClient();
  const { premium } = await getPremiumStatus(supabase, user.id);
  const { data } = await admin
    .from("analyses")
    .select(ROW_COLUMNS)
    .eq("user_id", user.id)
    .neq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(50);
  return Response.json((data ?? []).map((r) => toClientSummary(r as AnalysisRow, premium)));
});
