// SPEC 7.3 kalite kapısı. Eşikler Faz 4 sonunda 20–30 gönüllü fotoğrafıyla kalibre edilir (docs/calibration.md).
import { eulerFromMatrix } from "./pose";
import type { FrameAnalysis, Point } from "./types";

export type QualityConfig = {
  faceWidthRatio: { min: number; max: number };
  centerOffsetMax: number;
  yawMaxDeg: number;
  pitchMaxDeg: number;
  rollMaxDeg: number;
  brightness: { min: number; max: number };
  brightnessBalanceMax: number;
  sharpnessMin: number;
  eyeBlinkMax: number;
  mouthSmileMax: number;
  jawOpenMax: number;
  stableMs: number;
  countdownSeconds: number;
  maxFps: number;
};

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
} as const satisfies QualityConfig;

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

/** Elle çekimde gevşetilebilen (yumuşak) sorunlar. Diğerleri (yüz yok, birden fazla yüz, uzak/yakın, baş açısı,
 *  gözler kapalı, nötr olmayan ifade) her iki modda da çekimi engeller. */
export const SOFT_ISSUES = ["uneven_light", "blurry", "too_dark", "too_bright", "off_center"] as const satisfies readonly QualityIssue[];

/**
 * SPEC 7.3 değişikliği (UI spec §6.1): 8 sn sonra yalnız yumuşak sorunlar kalmışsa "Şimdi çek". Gevşek değerler sunucu
 * kapısının (C13: parlaklık 55–225, netlik ≥ 35) içinde kalır. relaxed yalnız saklanan üst veridir; hiçbir skoru
 * değiştirmez (C7) — yüz kırpımı parlaklığı ten rengine bağlı olduğu için skora bağlanmaz.
 */
export const MANUAL_QUALITY_CONFIG: QualityConfig = {
  ...QUALITY_CONFIG,
  brightness: { min: 60, max: 215 },
  brightnessBalanceMax: 50,
  sharpnessMin: 40,
  centerOffsetMax: 0.18,
};

export const MANUAL_CAPTURE = { offerAfterMs: 8_000 } as const;

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

const isSoft = (i: QualityIssue) => (SOFT_ISSUES as readonly QualityIssue[]).includes(i);

/** Canlı akış ≥ offerAfterMs sürdüyse, sıkı kontrol YALNIZ yumuşak sorunlarla kalıyorsa ve gevşek kontrol geçiyorsa true. */
export function manualOfferReady(frame: FrameAnalysis, liveMs: number): boolean {
  if (liveMs < MANUAL_CAPTURE.offerAfterMs) return false;
  const strict = checkQuality(frame);
  if (strict.passed || !strict.issues.every(isSoft)) return false;
  return checkQuality(frame, MANUAL_QUALITY_CONFIG).passed;
}

/** Çekim kartındaki kalite çipleri: sıkı eşiği geçen ölçü "good", yalnız gevşek eşiği geçen "ok". Ölçülemeyen değer sorun sayılmaz. */
export function qualitySummary(m: QualityReport["measures"]): { light: "good" | "ok"; sharpness: "good" | "ok"; framing: "good" | "ok" } {
  const c = QUALITY_CONFIG;
  const lightOk =
    (m.brightness === null || (m.brightness >= c.brightness.min && m.brightness <= c.brightness.max)) &&
    (m.brightnessBalance === null || m.brightnessBalance <= c.brightnessBalanceMax);
  return {
    light: lightOk ? "good" : "ok",
    sharpness: m.sharpness === null || m.sharpness >= c.sharpnessMin ? "good" : "ok",
    framing: m.centerOffset === null || m.centerOffset <= c.centerOffsetMax ? "good" : "ok",
  };
}
