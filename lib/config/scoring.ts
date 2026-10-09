// SPEC 8.1 ağırlıklar, 8.4 kalibrasyon v0, 8.5 potansiyel tavanları. Kodda sabit değil; burada ve env'de.
import type { SubKey } from "./teaser";

export const SUB_WEIGHTS: Record<SubKey, number> = {
  harmony: 0.25,
  eyes: 0.15,
  jawline: 0.15,
  skin: 0.15,
  hair: 0.15,
  grooming: 0.15,
};

/** Yapısal / geliştirilebilir rozeti (SPEC 8.1, 8.7). */
export const SUB_KIND: Record<SubKey, "structural" | "partial" | "modifiable"> = {
  harmony: "structural",
  eyes: "structural",
  jawline: "partial",
  skin: "modifiable",
  hair: "modifiable",
  grooming: "modifiable",
};

/** Kalibrasyon v0 (SPEC 8.4): overall = clamp(5.5 + (raw − RAW_MEAN) × SCALE, 1.0, 9.8). Faz 6'da 50 fotoğrafla ayarlanır. */
export const CALIBRATION_V0 = {
  target: 5.5,
  rawMean: 6.5,
  scale: 1.4,
  min: 1.0,
  max: 9.8,
  /** Alt skorlar için anahtar bazlı farklı değerler (yoksa genel). */
  perSub: {} as Partial<Record<SubKey, { rawMean: number; scale: number }>>,
} as const;

export const POTENTIAL = {
  caps: { skin: 1.5, hair: 1.5, grooming: 1.5, jawline: 1.0 },
  /** Yağ oranı bağlamı veya sakal seçeneği yoksa çene hattı tavanı. */
  jawlineCapWithoutLever: 0.3,
  maxAboveOverall: 1.5,
  absoluteMax: 9.5,
} as const;

/** Paralel skorlama çağrısı sayısı (SPEC 8.6; tutarsızlıkta 5'e çıkarılır). */
export const SCORE_CALLS = 3;
/** Çağrı başına zaman aşımı (ms). Toplam hedef p95 < 10 sn. */
export const SCORE_CALL_TIMEOUT_MS = 25_000;

export function getScoringEnv() {
  const scoreModel = process.env.GEMINI_SCORE_MODEL || "gemini-3.5-flash-lite";
  const calibrationVersion = process.env.SCORE_CALIBRATION_VERSION || "v0";
  return { scoreModel, calibrationVersion };
}
