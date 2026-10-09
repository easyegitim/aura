import "server-only";

import { ApiError } from "@/lib/api/errors";
import { ENTITLEMENTS } from "@/lib/config/plans";
import { createAdminClient } from "@/lib/db/admin";
import type { GeometryResult } from "@/lib/face/types";
import { QuestionnaireSchema } from "@/lib/questionnaire";
import { generateCoachReport } from "./generate";

export type StoredReport = { id: string; report: unknown; isFallback: boolean; createdAt: string; promptVersion: string };

export async function getLatestReport(userId: string, analysisId: string): Promise<StoredReport | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("coach_reports")
    .select("id, report, is_fallback, created_at, prompt_version")
    .eq("user_id", userId)
    .eq("analysis_id", analysisId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { id: String(data.id), report: data.report, isFallback: Boolean(data.is_fallback), createdAt: String(data.created_at), promptVersion: String(data.prompt_version) };
}

/** Rapor üret ve kaydet (SPEC Faz 9 madde 4). regenerate için hak: 1 + reportRegens. */
export async function createReport(userId: string, analysisId: string, regenerate: boolean): Promise<StoredReport> {
  const admin = createAdminClient();
  const { data: a } = await admin
    .from("analyses")
    .select("id, status, overall, potential, subscores, gains, observations, flags, geometry")
    .eq("id", analysisId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!a || a.status !== "completed") throw new ApiError("BAD_INPUT", "Tamamlanmış analiz bulunamadı.");

  const { count } = await admin.from("coach_reports").select("id", { count: "exact", head: true }).eq("analysis_id", analysisId);
  const existing = count ?? 0;
  if (existing > 0 && !regenerate) {
    const latest = await getLatestReport(userId, analysisId);
    if (latest) return latest;
  }
  if (existing > ENTITLEMENTS.premium.reportRegens) throw new ApiError("QUOTA_EXCEEDED", "Yeniden üretim hakkın doldu.");

  const { data: profile } = await admin.from("profiles").select("questionnaire").eq("id", userId).maybeSingle();
  const q = QuestionnaireSchema.safeParse(profile?.questionnaire);
  if (!q.success) throw new ApiError("BAD_INPUT", "Anket eksik; rapor için önce anketi tamamla.");

  const geometry = a.geometry as GeometryResult | null;
  const gen = await generateCoachReport({
    overall: Number(a.overall),
    potential: Number(a.potential),
    subscores: (a.subscores ?? {}) as Record<string, number>,
    gains: (a.gains ?? {}) as Parameters<typeof generateCoachReport>[0]["gains"],
    observations: (a.observations ?? {}) as Record<string, string>,
    flags: { visibleSkinConcern: Boolean((a.flags as { visibleSkinConcern?: boolean } | null)?.visibleSkinConcern), skinConcernNote: ((a.flags as { skinConcernNote?: string | null } | null)?.skinConcernNote ?? null) },
    faceShape: geometry?.faceShape ?? { primary: "oval", confidence: 0 },
    metrics: geometry?.metrics ?? null,
    questionnaire: q.data,
  });

  const { data: row, error } = await admin
    .from("coach_reports")
    .insert({
      user_id: userId,
      analysis_id: analysisId,
      model: gen.model,
      prompt_version: gen.promptVersion,
      report: gen.report,
      is_fallback: gen.isFallback,
      safety_flags: gen.safetyFlags, // yalnız kural adları
      input_tokens: gen.inputTokens,
      output_tokens: gen.outputTokens,
    })
    .select("id, created_at")
    .single();
  if (error || !row) throw new Error("coach_reports insert failed");
  return { id: String(row.id), report: gen.report, isFallback: gen.isFallback, createdAt: String(row.created_at), promptVersion: gen.promptVersion };
}
