import "server-only";

// Kamuya açık yöntem bilgisi (UI spec S6): /yontem, kamera güven kartı ve ilerleme adımları için.
// Gizli değer okumaz ve döndürmez; yalnız motor adı, kalibrasyon sürümü ve sağlayıcı görünen adları.
import { isFeatureEnabled } from "@/lib/config/flags";
import { getScoreEngine, getScoringEnv, type ScoreEngine } from "@/lib/config/scoring";

export type PublicEngineInfo = {
  engine: ScoreEngine;
  calibrationVersion: string;
  analysisProvider: string;
  tryonProvider: string;
  /** Yapısal alanların genel skordaki payı (%). Motor ağırlıkları server-only motor yapılandırmasına bağlanana kadar null. */
  structuralSharePct: number | null;
};

/** FEATURE_PROVIDER_NAMES kapalıyken (hukuki onay öncesi) her sağlayıcı adı bu nötr metinle gösterilir. */
export const NEUTRAL_PROVIDER_NAME = "yapay zekâ";

export function getPublicEngineInfo(env: Record<string, string | undefined> = process.env): PublicEngineInfo {
  const engine = getScoreEngine(env);
  const named = isFeatureEnabled("providerNames", env);
  const analysisProvider = engine === "hybrid.v1" ? "Anthropic (Claude)" : "Google (Gemini)";
  const tryonProvider = (env.TRYON_PROVIDER || "gemini") === "fal" ? "fal.ai" : "Google (Gemini)";
  return {
    engine,
    calibrationVersion: engine === "hybrid.v1" ? "h1" : getScoringEnv(env).calibrationVersion,
    analysisProvider: named ? analysisProvider : NEUTRAL_PROVIDER_NAME,
    tryonProvider: named ? tryonProvider : NEUTRAL_PROVIDER_NAME,
    structuralSharePct: null,
  };
}
