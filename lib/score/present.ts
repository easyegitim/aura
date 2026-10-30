// SPEC 14.1 teaser kırpması. Kilitli değerler JSON'a hiç girmez (null + locked:true).
// hybrid.v1 eklemeleri ve kilit kuralları: UI spec §1.2, engine spec §8.
import { SUB_KIND, SUB_KIND_HYBRID } from "@/lib/config/scoring";
import { SUB_KEYS, type SubKey, type TeaserMode } from "@/lib/config/teaser";
import type { FaceShape, GeometryResult } from "@/lib/face/types";
import {
  ClientSignals,
  type CaptureHint,
  type EngineName,
  type ExplainItem,
  type ImproveItem,
  type NotAssessed,
  type SubKind,
} from "@/lib/score/contract";

export type Locked<T> = { value: T; locked: false } | { value: null; locked: true };

export type AnalysisRow = {
  id: string;
  status: "processing" | "completed" | "failed";
  created_at: string;
  face_shape: string | null;
  overall: number | null;
  potential: number | null;
  subscores: Partial<Record<SubKey, number>> | null;
  gains: unknown;
  observations: unknown;
  geometry: GeometryResult | null;
  calibration_version: string | null;
  /** Migration 0009 sütunları; eski select listelerinde yok (undefined = eski satır). */
  prompt_version?: string | null;
  engine_version?: string | null;
  /** SignalsV1 (server-only); yalnız ClientSignals kısmı ayrıştırılır, kendisi istemciye gönderilmez. */
  signals?: unknown;
};

export type ClientAnalysis = {
  id: string;
  status: AnalysisRow["status"];
  createdAt: string;
  faceShape: FaceShape | string | null;
  faceShapeDetail: GeometryResult["faceShape"] | null;
  overall: Locked<number | null>;
  potential: Locked<number | null>;
  subscores: Record<SubKey, Locked<number | null>>;
  metrics: Locked<GeometryResult["metrics"] | null>;
  observations: Locked<unknown>;
  calibrationVersion: string | null;
  /** Açık: engine_version === "hybrid.v1" ise "hybrid.v1", değilse "legacy". */
  engine: EngineName;
  /** Açık: hybrid satırda SUB_KIND_HYBRID (çene hattı "structural"), eski satırda SUB_KIND. */
  kinds: Record<SubKey, SubKind>;
  /** round1(max(0, potential − overall)); potansiyelle aynı kilit (premium). */
  potentialDelta: Locked<number | null>;
  /** Yalnız premium; eski satır → { value: null, locked: false }. */
  improveFirst: Locked<ImproveItem[] | null>;
  /** Kilit subscores[k]'yı izler; eski satır ve hariç tutulan alt skor → { value: null, locked: false }. */
  explain: Record<SubKey, Locked<ExplainItem[] | null>>;
  /** "excluded" herkese; "not_visible" yalnız alt skor açıksa. */
  notAssessed: NotAssessed[];
  /** lighting/pose her zaman; skin_visibility/retouch yalnız cilt açıksa. */
  captureHints: CaptureHint[];
};

export type ClientAnalysisSummary = {
  id: string;
  status: AnalysisRow["status"];
  createdAt: string;
  faceShape: string | null;
  overall: number | null;
  potential: number | null;
  calibrationVersion: string | null;
  engine: EngineName;
};

export function engineOf(a: Pick<AnalysisRow, "engine_version">): EngineName {
  return a.engine_version === "hybrid.v1" ? "hybrid.v1" : "legacy";
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Hybrid satırda signals'ın istemci kısmı; eski satırda veya ayrıştırma hatasında null (türetilmiş alanlar varsayılana düşer). */
function readSignals(a: AnalysisRow, engine: EngineName): ClientSignals | null {
  if (engine !== "hybrid.v1") return null;
  const parsed = ClientSignals.safeParse(a.signals);
  if (parsed.success) return parsed.data;
  // Yalnız olay adı ve analiz kimliği; signals içeriği loglanmaz.
  console.warn(`[score] signals_parse_failed analysis=${a.id}`);
  return null;
}

export function toClientAnalysis(a: AnalysisRow, premium: boolean, mode: TeaserMode, teaserSub: SubKey): ClientAnalysis {
  const lock = <T,>(v: T, open: boolean): Locked<T> => (open ? { value: v, locked: false } : { value: null, locked: true });
  const openNull: Locked<null> = { value: null, locked: false };
  const showOverall = premium || mode === "overall_only";
  const subOpen = (k: SubKey) => premium || (mode === "shape_plus_one" && k === teaserSub);

  const engine = engineOf(a);
  const signals = readSignals(a, engine);
  // Hariç tutulan alt skorun değeri yoktur: kilitlenecek veya satılacak bir şey yok, herkese açık "–".
  const excluded = new Set<SubKey>(signals?.notAssessed.filter((n) => n.reason === "excluded").map((n) => n.sub) ?? []);

  const potentialDelta =
    a.potential != null && a.overall != null ? round1(Math.max(0, a.potential - a.overall)) : null;

  return {
    id: a.id,
    status: a.status,
    createdAt: a.created_at,
    faceShape: a.face_shape,
    faceShapeDetail: a.geometry?.faceShape ?? null,
    overall: lock(a.overall, showOverall),
    potential: lock(a.potential, premium),
    subscores: Object.fromEntries(
      SUB_KEYS.map((k) => [k, excluded.has(k) ? openNull : lock(a.subscores?.[k] ?? null, subOpen(k))]),
    ) as Record<SubKey, Locked<number | null>>,
    metrics: lock(a.geometry?.metrics ?? null, premium),
    observations: lock(a.observations, premium),
    calibrationVersion: a.calibration_version,
    engine,
    kinds: { ...(engine === "hybrid.v1" ? SUB_KIND_HYBRID : SUB_KIND) },
    potentialDelta: lock(potentialDelta, premium),
    // Sözleşme C9: değerlendirilmeyen alt skorun kaldıracı listelenmez (motor zaten yazmaz; burada savunma).
    improveFirst: signals
      ? lock(signals.improveFirst.filter((i) => !signals.notAssessed.some((n) => n.sub === i.sub)), premium)
      : openNull,
    explain: Object.fromEntries(
      SUB_KEYS.map((k) => [k, !signals || excluded.has(k) ? openNull : lock(signals.explain[k] ?? null, subOpen(k))]),
    ) as Record<SubKey, Locked<ExplainItem[] | null>>,
    // "Değerlendirilmedi" + bilinen referans değeri kilitli değeri ele verir: not_visible yalnız açık alt skorda.
    notAssessed: signals?.notAssessed.filter((n) => n.reason === "excluded" || subOpen(n.sub)) ?? [],
    captureHints: signals?.captureHints.filter((h) => h === "lighting" || h === "pose" || subOpen("skin")) ?? [],
  };
}

/** Liste görünümü (GET /api/analyses): ücretsizde skorlar null. */
export function toClientSummary(a: AnalysisRow, premium: boolean): ClientAnalysisSummary {
  return {
    id: a.id,
    status: a.status,
    createdAt: a.created_at,
    faceShape: a.face_shape,
    overall: premium ? a.overall : null,
    potential: premium ? a.potential : null,
    calibrationVersion: a.calibration_version,
    engine: engineOf(a),
  };
}
