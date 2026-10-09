import "server-only";

import { FACE_SHAPES } from "@/content/face-shapes";
import { buildFallbackReport } from "@/content/fallback-report";
import { ALL_PRESETS } from "@/content/presets";
import { getReportProvider, type ReportProvider } from "@/lib/ai/provider";
import { REPORT_PROMPT_VERSION, buildReportSystemPrompt, buildReportUserMessage, safetyRetryNote } from "@/lib/ai/prompts/report.v1";
import { CoachReport } from "@/lib/ai/reportSchema";
import { scanReport, stripViolations, type SafetyRule } from "@/lib/ai/safety";
import type { FaceShape, GeometryResult } from "@/lib/face/types";
import { deriveContext, type Questionnaire } from "@/lib/questionnaire";
import { bodyRules, type BodyRules } from "./bodyRules";
import { allowedCatalog, catalogForPrompt, type AllowedCatalog } from "./catalog";
import { exerciseEligible, hairAdviceAllowed } from "./eligibility";

export type ReportInput = {
  overall: number;
  potential: number;
  subscores: Record<string, number>;
  gains: Record<"skin" | "hair" | "grooming" | "jawline", { value: number; lever: string }>;
  observations: Record<string, string>;
  flags: { visibleSkinConcern: boolean; skinConcernNote: string | null };
  faceShape: GeometryResult["faceShape"];
  metrics: GeometryResult["metrics"] | null;
  questionnaire: Questionnaire;
};

export type GeneratedReport = {
  report: CoachReport;
  isFallback: boolean;
  safetyFlags: SafetyRule[];
  model: string;
  promptVersion: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

/** Kodda uygulanan sınırlar (SPEC 9.4, 9.8 kural 6–8): model ne derse desin. */
export function enforceRules(report: CoachReport, q: Questionnaire, body: BodyRules, catalog: AllowedCatalog): CoachReport {
  const r = structuredClone(report);
  const allowed = new Set([...catalog.hair, ...catalog.beard, ...catalog.color].map((p) => p.id));
  const exIds = new Set(catalog.exercises.map((e) => e.id));
  const stepIds = new Set(catalog.skinSteps.map((s) => s.id));
  const habitIds = new Set(catalog.habits.map((h) => h.id));
  r.hair = hairAdviceAllowed(q) ? r.hair.filter((p) => allowed.has(p.presetId)) : [];
  r.beard = r.beard.filter((p) => allowed.has(p.presetId));
  r.hairColor = hairAdviceAllowed(q) && r.hairColor && allowed.has(r.hairColor.presetId) ? r.hairColor : null;
  r.exercises = exerciseEligible(q) ? r.exercises.filter((e) => exIds.has(e.id)) : [];
  r.habits = r.habits.filter((h) => habitIds.has(h.id));
  for (const slot of ["morning", "evening", "weekly"] as const) r.skincare[slot] = r.skincare[slot].filter((s) => stepIds.has(s.stepType));
  if (!body.faceContoursEnabled) r.faceContours = { enabled: false, tips: [] };
  else r.faceContours.enabled = true;
  const known = new Set([...allowed, ...exIds, ...stepIds, ...habitIds]);
  for (const k of ["skin", "hair", "grooming", "jawline"] as const) r.linkedActions[k] = r.linkedActions[k].filter((id) => known.has(id));
  if (r.seeProfessional && !["dermatoloji", "sac_sagligi", "dis_ortodonti", "diyetisyen", "psikolog"].includes(r.seeProfessional.specialty)) r.seeProfessional = null;
  return r;
}

/** Geçerli presetId var mı (şema sonrası kimlik doğrulaması)? Bilinmeyen id'ler şema hatası sayılır → tekrar. */
function hasUnknownIds(report: CoachReport): boolean {
  const ids = new Set(ALL_PRESETS.map((p) => p.id));
  const picks = [...report.hair, ...report.beard, ...(report.hairColor ? [report.hairColor] : [])];
  return picks.some((p) => !ids.has(p.presetId));
}

/**
 * SPEC 9.7/9.9 akışı: üret → şema (hata → 1 tekrar → fallback) → güvenlik (ihlal → uyarıyla 1 tekrar → öğeyi çıkar → summary ihlalliyse fallback).
 */
export async function generateCoachReport(input: ReportInput, provider: ReportProvider = getReportProvider()): Promise<GeneratedReport> {
  const q = input.questionnaire;
  const ctx = deriveContext(q);
  const body = bodyRules({ bmi: ctx.bmi, note: q.note });
  const catalog = allowedCatalog({ faceShape: input.faceShape.primary, questionnaire: q, body });
  const shape = FACE_SHAPES[input.faceShape.primary as FaceShape];
  const system = buildReportSystemPrompt({ bodyFatContextAllowed: body.faceContoursEnabled, exerciseEligible: exerciseEligible(q) });
  const user = buildReportUserMessage({
    overall: input.overall,
    potential: input.potential,
    subscores: input.subscores,
    gains: input.gains,
    observations: input.observations,
    flags: input.flags,
    faceShape: { primary: input.faceShape.primary, secondary: input.faceShape.secondary, nameTr: shape.nameTr, descriptionTr: shape.descriptionTr },
    geometrySummary: input.metrics ? { canthalTiltDeg: input.metrics.canthalTiltDeg, jawRatio: input.metrics.jawRatio, fwhr: input.metrics.fwhr, thirds: input.metrics.thirds } : {},
    questionnaire: { ...q, note: q.note ?? "" },
    catalog: catalogForPrompt(catalog),
    headCovering: q.headCovering,
  });

  const fallback = (flags: SafetyRule[]): GeneratedReport => ({
    report: buildFallbackReport({ overall: input.overall, potential: input.potential, faceShape: input.faceShape.primary, questionnaire: q, catalog, body, flags: input.flags, gains: input.gains }),
    isFallback: true,
    safetyFlags: flags,
    model: provider.model,
    promptVersion: REPORT_PROMPT_VERSION,
    inputTokens: null,
    outputTokens: null,
  });

  // 1) Şema: 2 deneme
  let parsed: CoachReport | null = null;
  let tokens = { inputTokens: null as number | null, outputTokens: null as number | null };
  for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
    try {
      const gen = await provider.generateReport(system, user);
      const r = CoachReport.safeParse(gen.report);
      if (r.success && !hasUnknownIds(r.data)) {
        parsed = r.data;
        tokens = { inputTokens: gen.inputTokens, outputTokens: gen.outputTokens };
      }
    } catch {
      // ağ/zaman aşımı: tekrar
    }
  }
  if (!parsed) return fallback([]);

  // 2) Güvenlik: ihlal → uyarıyla 1 tekrar → öğeyi çıkar → summary ihlalliyse fallback
  let report = enforceRules(parsed, q, body, catalog);
  let violations = scanReport(report, { faceContoursEnabled: body.faceContoursEnabled });
  const flags = new Set<SafetyRule>(violations.map((v) => v.rule));
  if (violations.length > 0) {
    try {
      const gen = await provider.generateReport(system + safetyRetryNote([...flags]), user);
      const r = CoachReport.safeParse(gen.report);
      if (r.success && !hasUnknownIds(r.data)) {
        const candidate = enforceRules(r.data, q, body, catalog);
        const v2 = scanReport(candidate, { faceContoursEnabled: body.faceContoursEnabled });
        if (v2.length <= violations.length) {
          report = candidate;
          violations = v2;
          tokens = { inputTokens: gen.inputTokens, outputTokens: gen.outputTokens };
        }
      }
    } catch {
      // tekrar başarısız; öğe çıkarma ile devam
    }
    if (violations.length > 0) {
      violations.forEach((v) => flags.add(v.rule));
      const stripped = stripViolations(report, violations);
      if (!stripped) return fallback([...flags]);
      report = stripped;
      if (scanReport(report, { faceContoursEnabled: body.faceContoursEnabled }).length > 0) return fallback([...flags]);
    }
  }

  return { report, isFallback: false, safetyFlags: [...flags], model: provider.model, promptVersion: REPORT_PROMPT_VERSION, ...tokens };
}
