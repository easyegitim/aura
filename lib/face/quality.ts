// SPEC 7.3 kalite kapısı. Eşikler Faz 4 sonunda 20–30 gönüllü fotoğrafıyla kalibre edilir (docs/calibration.md).
import { eulerFromMatrix } from "./pose";
import type { FrameAnalysis, Point } from "./types";

export const QUALITY_CONFIG = {
  faceWidthRatio: { min: 0.35, max: 0.75 },
  centerOffsetMax: 0.12,
  yawMaxDeg: 8,
  pitchMaxDeg: 10,
  rollMaxDeg: 6,
  brightness: { min: 80, max: 200 },
  brightnessBalanceMax: 35,
  sharpnessMin: 60,
  eyeBlinkMax: 0.4,
  mouthSmileMax: 0.4,
  jawOpenMax: 0.15,
  /** Tüm koşullar bu süre boyunca sağlanınca geri sayım başlar. */
  stableMs: 600,
  countdownSeconds: 3,
  /** Canlı önizlemede saniyede en fazla işlenen kare. */
  maxFps: 10,
} as const;

export type QualityConfig = typeof QUALITY_CONFIG;

export type QualityIssue =
  | "no_face"
  | "multiple_faces"
  | "too_far"
  | "too_close"
  | "off_center"
  | "head_angle"
  | "too_dark"
  | "too_bright"
  | "uneven_light"
  | "blurry"
  | "eyes_closed"
  | "not_neutral";

export type QualityWarning = "hair_not_visible";

export type QualityReport = {
  passed: boolean;
  /** Öncelik sırasına göre; ilk öğe ekranda gösterilir. */
  issues: QualityIssue[];
  warnings: QualityWarning[];
  measures: {
    faceWidthRatio: number | null;
    centerOffset: number | null;
    yaw: number | null;
    pitch: number | null;
    roll: number | null;
    brightness: number | null;
    brightnessBalance: number | null;
    sharpness: number | null;
  };
};

/** Normalize noktalardan yüz kutusu (0–1). */
export function faceBox(landmarks: Point[]) {
  let minX = 1,
    minY = 1,
    maxX = 0,
    maxY = 0;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

export function checkQuality(frame: FrameAnalysis, cfg: QualityConfig = QUALITY_CONFIG): QualityReport {
  const issues: QualityIssue[] = [];
  const warnings: QualityWarning[] = [];
  const measures: QualityReport["measures"] = {
    faceWidthRatio: null,
    centerOffset: null,
    yaw: null,
    pitch: null,
    roll: null,
    brightness: frame.brightness,
    brightnessBalance: frame.brightnessBalance,
    sharpness: frame.sharpness,
  };

  if (frame.faces === 0 || !frame.landmarks) {
    issues.push(frame.faces > 1 ? "multiple_faces" : "no_face");
    return { passed: false, issues, warnings, measures };
  }
  if (frame.faces > 1) {
    issues.push("multiple_faces");
    return { passed: false, issues, warnings, measures };
  }

  const box = faceBox(frame.landmarks);
  measures.faceWidthRatio = box.width;
  if (box.width < cfg.faceWidthRatio.min) issues.push("too_far");
  else if (box.width > cfg.faceWidthRatio.max) issues.push("too_close");

  measures.centerOffset = Math.hypot(box.cx - 0.5, box.cy - 0.5);
  if (measures.centerOffset > cfg.centerOffsetMax) issues.push("off_center");

  if (frame.matrix) {
    const pose = eulerFromMatrix(frame.matrix);
    measures.yaw = pose.yaw;
    measures.pitch = pose.pitch;
    measures.roll = pose.roll;
    if (Math.abs(pose.yaw) > cfg.yawMaxDeg || Math.abs(pose.pitch) > cfg.pitchMaxDeg || Math.abs(pose.roll) > cfg.rollMaxDeg) {
      issues.push("head_angle");
    }
  }

  if (frame.brightness !== null) {
    if (frame.brightness < cfg.brightness.min) issues.push("too_dark");
    else if (frame.brightness > cfg.brightness.max) issues.push("too_bright");
  }
  if (frame.brightnessBalance !== null && frame.brightnessBalance > cfg.brightnessBalanceMax) issues.push("uneven_light");
  if (frame.sharpness !== null && frame.sharpness < cfg.sharpnessMin) issues.push("blurry");

  if (frame.blendshapes) {
    const b = frame.blendshapes;
    if (b.eyeBlinkLeft > cfg.eyeBlinkMax || b.eyeBlinkRight > cfg.eyeBlinkMax) issues.push("eyes_closed");
    if (b.mouthSmileLeft > cfg.mouthSmileMax || b.mouthSmileRight > cfg.mouthSmileMax || b.jawOpen > cfg.jawOpenMax) {
      issues.push("not_neutral");
    }
  }

  if (frame.hairVisible === false) warnings.push("hair_not_visible");

  return { passed: issues.length === 0, issues, warnings, measures };
}
