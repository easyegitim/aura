// SPEC 14.1 teaser kırpması. Kilitli değerler JSON'a hiç girmez (null + locked:true).
import { SUB_KEYS, type SubKey, type TeaserMode } from "@/lib/config/teaser";
import type { FaceShape, GeometryResult } from "@/lib/face/types";

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
};

export type ClientAnalysisSummary = {
  id: string;
  status: AnalysisRow["status"];
  createdAt: string;
  faceShape: string | null;
  overall: number | null;
  potential: number | null;
  calibrationVersion: string | null;
};

export function toClientAnalysis(a: AnalysisRow, premium: boolean, mode: TeaserMode, teaserSub: SubKey): ClientAnalysis {
  const lock = <T,>(v: T, open: boolean): Locked<T> => (open ? { value: v, locked: false } : { value: null, locked: true });
  const showOverall = premium || mode === "overall_only";
  return {
    id: a.id,
    status: a.status,
    createdAt: a.created_at,
    faceShape: a.face_shape,
    faceShapeDetail: a.geometry?.faceShape ?? null,
    overall: lock(a.overall, showOverall),
    potential: lock(a.potential, premium),
    subscores: Object.fromEntries(
      SUB_KEYS.map((k) => [k, lock(a.subscores?.[k] ?? null, premium || (mode === "shape_plus_one" && k === teaserSub))]),
    ) as Record<SubKey, Locked<number | null>>,
    metrics: lock(a.geometry?.metrics ?? null, premium),
    observations: lock(a.observations, premium),
    calibrationVersion: a.calibration_version,
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
  };
}
