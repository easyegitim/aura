import { describe, expect, it } from "vitest";
import { IDX } from "@/lib/face/indices";
import { computeMetrics, computeStableGeometry, eyeTilt, median, rollCorrect, toPixels } from "@/lib/face/metrics";
import type { FrameAnalysis } from "@/lib/face/types";
import { normalize, syntheticFace } from "../helpers/syntheticFace";

const base = { cheek: 100, length: 140, jaw: 84, forehead: 90 };

describe("computeMetrics (SPEC 7.5)", () => {
  it("oranlar tanımdan çıkar", () => {
    const m = computeMetrics(syntheticFace(base), null);
    expect(m.lengthRatio).toBeCloseTo(1.4, 6);
    expect(m.jawRatio).toBeCloseTo(0.84, 6);
    expect(m.foreheadRatio).toBeCloseTo(0.9, 6);
    expect(m.fwhr).toBeCloseTo(100 / (140 * 0.45), 6); // cheek / d(0, orta(105,334))
    expect(m.lowerToMiddle).toBeCloseTo(0.43 / 0.34, 6);
    expect(m.hairlineFound).toBe(false);
    expect(m.thirds.upper).toBeNull();
    expect(m.thirds.middle + m.thirds.lower).toBeCloseTo(1, 6);
  });

  it("saç çizgisi varsa üçte birler toplamı 1", () => {
    const L = syntheticFace(base);
    const hairlineY = L[IDX.glabella].y - 0.3 * 140;
    const m = computeMetrics(L, hairlineY);
    expect(m.hairlineFound).toBe(true);
    expect(m.thirds.upper! + m.thirds.middle + m.thirds.lower).toBeCloseTo(1, 6);
    expect(m.thirds.upper).toBeCloseTo(0.3 / (0.3 + 0.34 + 0.43), 6);
  });

  it("saç çizgisi glabella'nın altındaysa (geçersiz) bulunmamış sayılır", () => {
    const L = syntheticFace(base);
    expect(computeMetrics(L, L[IDX.glabella].y + 10).hairlineFound).toBe(false);
  });
});

describe("canthal tilt işareti", () => {
  it("dış köşe yukarıdaysa pozitif, aşağıdaysa negatif, düzse 0", () => {
    expect(computeMetrics(syntheticFace({ ...base, eyeLift: 5 }), null).canthalTiltDeg).toBeGreaterThan(0);
    expect(computeMetrics(syntheticFace({ ...base, eyeLift: -5 }), null).canthalTiltDeg).toBeLessThan(0);
    expect(computeMetrics(syntheticFace(base), null).canthalTiltDeg).toBeCloseTo(0, 6);
  });
  it("eyeTilt her iki göz için aynı işareti verir", () => {
    // sağ göz: iç (120, 100), dış (100, 95) → dış yukarıda → pozitif
    expect(eyeTilt({ x: 120, y: 100 }, { x: 100, y: 95 }, "right")).toBeGreaterThan(0);
    // sol göz: iç (130, 100), dış (150, 95)
    expect(eyeTilt({ x: 130, y: 100 }, { x: 150, y: 95 }, "left")).toBeGreaterThan(0);
    expect(eyeTilt({ x: 120, y: 100 }, { x: 100, y: 95 }, "right")).toBeCloseTo(eyeTilt({ x: 130, y: 100 }, { x: 150, y: 95 }, "left"), 6);
  });
});

describe("rollCorrect", () => {
  it("12° döndürülmüş yüzde roll'u geri bulur ve metrikler değişmez", () => {
    const straight = computeMetrics(syntheticFace(base), null);
    const rolled = syntheticFace({ ...base, rollDeg: 12 });
    const { points, rollDeg } = rollCorrect(rolled);
    expect(rollDeg).toBeCloseTo(12, 5);
    const m = computeMetrics(points, null);
    expect(m.lengthRatio).toBeCloseTo(straight.lengthRatio, 5);
    expect(m.jawRatio).toBeCloseTo(straight.jawRatio, 5);
    expect(m.canthalTiltDeg).toBeCloseTo(straight.canthalTiltDeg, 5);
    expect(m.lowerToMiddle).toBeCloseTo(straight.lowerToMiddle, 5);
  });
});

describe("median ve computeStableGeometry", () => {
  it("median tek ve çift uzunlukta doğru", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  function frame(length: number, extra: Partial<FrameAnalysis> = {}): FrameAnalysis {
    return {
      width: 720,
      height: 960,
      faces: 1,
      landmarks: normalize(syntheticFace({ ...base, length, cx: 360, cy: 480 }), 720, 960),
      blendshapes: null,
      matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      brightness: 130,
      brightnessBalance: 5,
      sharpness: 90,
      hairVisible: true,
      timestamp: 0,
      ...extra,
    };
  }

  it("5 karenin medyanını alır; aykırı kare sonucu bozmaz", () => {
    const frames = [140, 141, 139, 200, 140].map((len) => ({ frame: frame(len), hairline: null }));
    const g = computeStableGeometry(frames);
    expect(g.version).toBe("geo-v1");
    expect(g.metrics.lengthRatio).toBeCloseTo(1.4, 2);
    expect(g.metrics.hairlineFound).toBe(false);
    expect(g.quality.brightness).toBe(130);
    expect(g.faceShape.primary).toBe("oval");
  });

  it("en fazla son 5 kare kullanılır ve yüzsüz kareler atlanır", () => {
    const frames = [
      { frame: frame(300), hairline: null },
      { frame: frame(300), hairline: null },
      ...[140, 140, 140, 140, 140].map((len) => ({ frame: frame(len), hairline: null })),
      { frame: frame(140, { faces: 0, landmarks: null }), hairline: null },
    ];
    expect(computeStableGeometry(frames).metrics.lengthRatio).toBeCloseTo(1.4, 2);
  });

  it("yüz yoksa fırlatır; çıktıda ham nokta dizisi yoktur", () => {
    expect(() => computeStableGeometry([{ frame: frame(140, { faces: 0, landmarks: null }), hairline: null }])).toThrow("no_landmarks");
    const g = computeStableGeometry([{ frame: frame(140), hairline: null }]);
    expect(JSON.stringify(g)).not.toContain("landmarks");
    expect(JSON.stringify(g).length).toBeLessThan(600);
  });

  it("toPixels normalize noktaları piksele çevirir", () => {
    expect(toPixels([{ x: 0.5, y: 0.25 }], 720, 960)[0]).toEqual({ x: 360, y: 240, z: undefined });
  });
});
