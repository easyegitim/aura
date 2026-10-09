import "server-only";

import { getScoringProvider, type ScoringProvider } from "@/lib/ai/provider";
import { SCORE_PROMPT_VERSION, buildScorePrompt } from "@/lib/ai/prompts/score.v1";
import type { ScoreOutput } from "@/lib/ai/scoreSchema";
import { SCORE_CALLS, SCORE_CALL_TIMEOUT_MS, getScoringEnv } from "@/lib/config/scoring";
import { SUB_KEYS, type SubKey } from "@/lib/config/teaser";
import type { GeometryResult } from "@/lib/face/types";
import type { Questionnaire } from "@/lib/questionnaire";
import { aggregateScores, type Aggregated } from "./aggregate";
import { calibrate, type CalibrationVersion } from "./calibration";
import { computePotential } from "./potential";

export type ScoringContext = {
  presentation: Questionnaire["presentation"];
  bodyFatContextAllowed: boolean;
  beardOption: boolean;
};

export type ScoredAnalysis = {
  subscores: Record<SubKey, number>;
  rawSubscores: Record<SubKey, number>;
  rawOverall: number;
  overall: number;
  potential: number;
  gains: Aggregated["gains"];
  observations: ScoreOutput["observations"];
  flags: ScoreOutput["flags"];
  samples: number;
  model: string;
  promptVersion: string;
  calibrationVersion: CalibrationVersion;
};

/** SPEC 8.2: N paralel çağrı (temperature 0) → medyan → kalibrasyon → potansiyel. Saf hesap; DB yok. */
export async function scoreImage(
  imageBase64: string,
  geometry: GeometryResult,
  ctx: ScoringContext,
  provider: ScoringProvider = getScoringProvider(),
  calls = SCORE_CALLS,
): Promise<ScoredAnalysis> {
  const prompt = buildScorePrompt({ presentation: ctx.presentation, geometry, bodyFatContextAllowed: ctx.bodyFatContextAllowed });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCORE_CALL_TIMEOUT_MS + 2_000);
  let settled: PromiseSettledResult<ScoreOutput>[];
  try {
    settled = await Promise.allSettled(Array.from({ length: calls }, () => provider.scoreOnce(imageBase64, prompt, controller.signal)));
  } finally {
    clearTimeout(timer);
  }
  const agg = aggregateScores(settled);
  const version = getScoringEnv().calibrationVersion as CalibrationVersion;

  const subscores = Object.fromEntries(SUB_KEYS.map((k) => [k, calibrate(agg.rawSubscores[k], version, { sub: k })])) as Record<SubKey, number>;
  const overall = calibrate(agg.rawOverall, version);
  const potential = computePotential({
    rawSubscores: agg.rawSubscores,
    gains: agg.gains,
    overall,
    bodyFatContextAllowed: ctx.bodyFatContextAllowed,
    beardOption: ctx.beardOption,
    calibrate: (raw) => calibrate(raw, version),
  });

  return {
    subscores,
    rawSubscores: agg.rawSubscores,
    rawOverall: Math.round(agg.rawOverall * 100) / 100,
    overall,
    potential,
    gains: agg.gains,
    observations: agg.observations,
    flags: agg.flags,
    samples: agg.samples,
    model: provider.model,
    promptVersion: SCORE_PROMPT_VERSION,
    calibrationVersion: version,
  };
}
