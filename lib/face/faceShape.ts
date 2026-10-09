// SPEC 7.6: kural tabanlı yüz şekli. Eşikler tek nesnede; Faz 5 test setiyle ayarlanır.
import type { FaceShape, GeometryResult } from "./types";

type ShapeMetrics = Pick<GeometryResult["metrics"], "lengthRatio" | "jawRatio" | "foreheadRatio">;

export const FACE_SHAPE_THRESHOLDS = {
  longLengthMin: 1.5,
  squareJawMin: 0.9,
  squareLengthMax: 1.35,
  roundLengthMax: 1.3,
  roundJawMax: 0.9,
  heartForeheadOverJaw: 0.1,
  diamondForeheadMax: 0.8,
  diamondJawMax: 0.8,
  /** Bu kadar oran uzaklığı tam güven sayılır; altında orantılı. */
  fullConfidenceMargin: 0.1,
  /** Bu güvenin altında ikinci şekil de gösterilir (SPEC 7.6). */
  secondaryBelow: 0.3,
} as const;

type Condition = { value: (m: ShapeMetrics) => number; op: ">=" | "<"; threshold: (m: ShapeMetrics) => number };
type Rule = { shape: FaceShape; conditions: Condition[] };

const T = FACE_SHAPE_THRESHOLDS;
/** Sırayla denenir; ilk eşleşen kazanır. Hiçbiri → oval. */
const RULES: Rule[] = [
  { shape: "long", conditions: [{ value: (m) => m.lengthRatio, op: ">=", threshold: () => T.longLengthMin }] },
  {
    shape: "square",
    conditions: [
      { value: (m) => m.jawRatio, op: ">=", threshold: () => T.squareJawMin },
      { value: (m) => m.lengthRatio, op: "<", threshold: () => T.squareLengthMax },
    ],
  },
  {
    shape: "round",
    conditions: [
      { value: (m) => m.lengthRatio, op: "<", threshold: () => T.roundLengthMax },
      { value: (m) => m.jawRatio, op: "<", threshold: () => T.roundJawMax },
    ],
  },
  { shape: "heart", conditions: [{ value: (m) => m.foreheadRatio, op: ">=", threshold: (m) => m.jawRatio + T.heartForeheadOverJaw }] },
  {
    shape: "diamond",
    conditions: [
      { value: (m) => m.foreheadRatio, op: "<", threshold: () => T.diamondForeheadMax },
      { value: (m) => m.jawRatio, op: "<", threshold: () => T.diamondJawMax },
    ],
  },
];

/** Koşul sağlanıyorsa pozitif (eşiğe uzaklık), sağlanmıyorsa negatif (eksik). */
function slack(c: Condition, m: ShapeMetrics): number {
  const v = c.value(m);
  const t = c.threshold(m);
  return c.op === ">=" ? v - t : t - v;
}

/** "≥" eşitlikte sağlanır; "<" sıkı eşitsizliktir (SPEC 7.6). */
function matches(rule: Rule, m: ShapeMetrics) {
  return rule.conditions.every((c) => (c.op === ">=" ? slack(c, m) >= 0 : slack(c, m) > 0));
}

export function classifyFaceShape(m: ShapeMetrics): GeometryResult["faceShape"] {
  const idx = RULES.findIndex((r) => matches(r, m));
  const primary: FaceShape = idx === -1 ? "oval" : RULES[idx].shape;

  // Birincil kuralın marjı: eşleşen kuralda en dar sağlanan koşul; ovalde en yakın (sağlanmayan) kuralın eksiği.
  // Ayrıca daha önce denenen kuralların "neredeyse eşleşmesi" de güveni düşürür.
  let margin = Infinity;
  let secondary: FaceShape | undefined;

  if (idx !== -1) {
    margin = Math.min(...RULES[idx].conditions.map((c) => slack(c, m)));
    // Eşleşen kuraldan önceki kurallardan biri az farkla kaçırıldıysa, o ikinci adaydır.
    for (let i = 0; i < idx; i++) {
      const deficit = -Math.min(...RULES[i].conditions.map((c) => slack(c, m)));
      if (deficit < margin) {
        margin = deficit;
        secondary = RULES[i].shape;
      }
    }
    if (!secondary) secondary = nextShapeIfCrossed(idx, m);
  } else {
    for (const r of RULES) {
      const deficit = -Math.min(...r.conditions.map((c) => slack(c, m)));
      if (deficit < margin) {
        margin = deficit;
        secondary = r.shape;
      }
    }
  }

  const confidence = Math.max(0, Math.min(1, margin / T.fullConfidenceMargin));
  const result: GeometryResult["faceShape"] = { primary, confidence: Number(confidence.toFixed(2)) };
  if (confidence < T.secondaryBelow && secondary && secondary !== primary) result.secondary = secondary;
  return result;
}

/** Eşleşen kuralın en dar koşulu aşılırsa hangi şekil olurdu? */
function nextShapeIfCrossed(idx: number, m: ShapeMetrics): FaceShape {
  const rest = RULES.slice(idx + 1);
  const next = rest.find((r) => matches(r, m));
  return next ? next.shape : "oval";
}
