import { describe, expect, it } from "vitest";
import { toClientAnalysis, toClientSummary, type AnalysisRow } from "@/lib/score/present";

const row: AnalysisRow = {
  id: "a1",
  status: "completed",
  created_at: "2026-10-09T10:00:00Z",
  face_shape: "oval",
  overall: 6.4,
  potential: 7.6,
  subscores: { harmony: 6.1, eyes: 6.0, jawline: 6.3, skin: 5.9, hair: 6.8, grooming: 6.2 },
  gains: {},
  observations: { skin: "alında parlama" },
  geometry: {
    version: "geo-v1",
    quality: { yaw: 1, pitch: 2, roll: 0, brightness: 120, sharpness: 90, passed: true },
    metrics: { lengthRatio: 1.4, jawRatio: 0.84, foreheadRatio: 0.9, fwhr: 1.9, canthalTiltDeg: 3, lowerToMiddle: 1.2, thirds: { upper: 0.3, middle: 0.33, lower: 0.37 }, hairlineFound: true },
    faceShape: { primary: "oval", confidence: 0.8 },
    capturedAt: "2026-10-09T10:00:00Z",
  },
  calibration_version: "v0",
};

describe("toClientAnalysis (SPEC 14.1 / 5.3)", () => {
  it("shape_plus_one: yüz şekli + bir alt skor açık; genel, potansiyel, diğer alt skorlar, oranlar, gözlemler kilitli ve JSON'da yok", () => {
    const c = toClientAnalysis(row, false, "shape_plus_one", "skin");
    expect(c.faceShape).toBe("oval");
    expect(c.subscores.skin).toEqual({ value: 5.9, locked: false });
    expect(c.subscores.hair).toEqual({ value: null, locked: true });
    expect(c.overall).toEqual({ value: null, locked: true });
    expect(c.potential).toEqual({ value: null, locked: true });
    expect(c.metrics.locked).toBe(true);
    expect(c.observations.locked).toBe(true);
    const json = JSON.stringify(c);
    expect(json).not.toContain("6.4");
    expect(json).not.toContain("7.6");
    expect(json).not.toContain("6.8");
    expect(json).not.toContain("parlama");
    expect(json).not.toContain("lengthRatio");
  });
  it("overall_only: genel skor açık, potansiyel ve alt skorlar kilitli", () => {
    const c = toClientAnalysis(row, false, "overall_only", "skin");
    expect(c.overall).toEqual({ value: 6.4, locked: false });
    expect(c.potential.locked).toBe(true);
    expect(c.subscores.skin.locked).toBe(true);
  });
  it("shape_only: yalnız yüz şekli", () => {
    const c = toClientAnalysis(row, false, "shape_only", "skin");
    expect(c.overall.locked).toBe(true);
    expect(Object.values(c.subscores).every((s) => s.locked)).toBe(true);
    expect(c.faceShape).toBe("oval");
  });
  it("premium: her şey açık", () => {
    const c = toClientAnalysis(row, true, "shape_plus_one", "skin");
    expect(c.overall).toEqual({ value: 6.4, locked: false });
    expect(c.potential).toEqual({ value: 7.6, locked: false });
    expect(c.subscores.hair).toEqual({ value: 6.8, locked: false });
    expect(c.metrics.locked).toBe(false);
  });
  it("özet listede ücretsiz kullanıcıya skor gitmez", () => {
    expect(toClientSummary(row, false).overall).toBeNull();
    expect(toClientSummary(row, true).overall).toBe(6.4);
  });
});
