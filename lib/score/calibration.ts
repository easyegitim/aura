// SPEC 8.4. Kalibrasyon herkes için aynıdır; ödeme/plan/kampanya girdisi YOKTUR (D03).
import { CALIBRATION_V0 } from "@/lib/config/scoring";
import type { SubKey } from "@/lib/config/teaser";

export type CalibrationVersion = "v0" | "v1";

/** v1: ham → hedef yüzdelik eşleme tablosu, parça parça doğrusal (content/score-calibration.v1.json). */
export type CalibrationTable = { overall: [number, number][]; subscores?: Partial<Record<SubKey, [number, number][]>> };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const round1 = (v: number) => Math.round(v * 10) / 10;

export function calibrateV0(raw: number, sub?: SubKey): number {
  const c = CALIBRATION_V0;
  const p = (sub && c.perSub[sub]) || { rawMean: c.rawMean, scale: c.scale };
  return clamp(c.target + (raw - p.rawMean) * p.scale, c.min, c.max);
}

/** Parça parça doğrusal ara değer; tablo (raw, calibrated) çiftleri artan sırada. Uçlarda sabitlenir. */
export function interpolate(table: [number, number][], raw: number): number {
  if (table.length === 0) throw new Error("calibration_table_empty");
  if (raw <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (raw >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const [x0, y0] = table[i - 1];
    const [x1, y1] = table[i];
    if (raw <= x1) return y0 + ((raw - x0) / (x1 - x0)) * (y1 - y0);
  }
  return last[1];
}

export function calibrateV1(raw: number, table: CalibrationTable, sub?: SubKey): number {
  const t = (sub && table.subscores?.[sub]) || table.overall;
  return clamp(interpolate(t, raw), CALIBRATION_V0.min, CALIBRATION_V0.max);
}

/**
 * Kalibre skor (1 ondalık). v1 için tablo verilmelidir; verilmezse hata (sahte tablo kullanılmaz).
 */
export function calibrate(raw: number, version: CalibrationVersion, opts: { sub?: SubKey; table?: CalibrationTable } = {}): number {
  if (version === "v0") return round1(calibrateV0(raw, opts.sub));
  if (!opts.table) throw new Error("calibration_v1_table_missing");
  return round1(calibrateV1(raw, opts.table, opts.sub));
}
