import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FACE_SHAPE_THRESHOLDS as T, classifyFaceShape } from "@/lib/face/faceShape";
import { computeMetrics } from "@/lib/face/metrics";
import type { Point } from "@/lib/face/types";
import { SHAPE_PARAMS, syntheticFace } from "../helpers/syntheticFace";

const shape = (lengthRatio: number, jawRatio: number, foreheadRatio: number) => classifyFaceShape({ lengthRatio, jawRatio, foreheadRatio });

describe("classifyFaceShape (SPEC 7.6 kural sırası)", () => {
  it("uzun: lengthRatio ≥ 1,50 her şeyden önce gelir", () => {
    expect(shape(1.5, 0.95, 0.95).primary).toBe("long");
    expect(shape(1.499, 0.95, 0.95).primary).not.toBe("long");
  });
  it("kare: jaw ≥ 0,90 ve length < 1,35", () => {
    expect(shape(1.2, 0.9, 0.85).primary).toBe("square");
    expect(shape(1.35, 0.9, 0.85).primary).not.toBe("square");
    expect(shape(1.2, 0.899, 0.85).primary).toBe("round");
  });
  it("yuvarlak: length < 1,30 ve jaw < 0,90", () => {
    expect(shape(1.29, 0.85, 0.85).primary).toBe("round");
    expect(shape(1.3, 0.85, 0.85).primary).not.toBe("round");
  });
  it("kalp: forehead ≥ jaw + 0,10", () => {
    expect(shape(1.4, 0.8, 0.9).primary).toBe("heart");
    expect(shape(1.4, 0.8, 0.899).primary).not.toBe("heart");
  });
  it("elmas: forehead < 0,80 ve jaw < 0,80", () => {
    expect(shape(1.4, 0.75, 0.75).primary).toBe("diamond");
    expect(shape(1.4, 0.8, 0.75).primary).toBe("oval");
  });
  it("hiçbiri → oval", () => {
    expect(shape(1.42, 0.84, 0.88).primary).toBe("oval");
  });
});

describe("güven ve ikinci şekil", () => {
  it("eşiğin tam üstünde güven düşük ve ikinci şekil gösterilir", () => {
    const r = shape(1.51, 0.84, 0.88); // long eşiğine 0,01 uzak
    expect(r.primary).toBe("long");
    expect(r.confidence).toBeLessThan(T.secondaryBelow);
    expect(r.secondary).toBeDefined();
    expect(r.secondary).not.toBe("long");
  });
  it("eşiklerden uzakta güven yüksek, ikinci şekil yok", () => {
    const r = shape(1.75, 0.84, 0.88);
    expect(r.confidence).toBe(1);
    expect(r.secondary).toBeUndefined();
  });
  it("oval ile yuvarlak arası: yuvarlağı az farkla kaçıran yüz ikinci şekil olarak yuvarlak verir", () => {
    const r = shape(1.31, 0.85, 0.85); // round için length < 1,30 gerekir; 0,01 eksik
    expect(r.primary).toBe("oval");
    expect(r.secondary).toBe("round");
    expect(r.confidence).toBeLessThan(T.secondaryBelow);
  });
  it("güven 0–1 aralığında", () => {
    for (const [l, j, f] of [[1.0, 0.5, 0.5], [2.0, 1.2, 1.2], [1.4, 0.84, 0.88]]) {
      const c = shape(l, j, f).confidence;
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });
});

describe("sentetik fixture'lar (tests/fixtures/landmarks)", () => {
  const dir = path.resolve(__dirname, "..", "fixtures", "landmarks");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  it("6 şekil için fixture var", () => {
    expect(files.sort()).toEqual(["diamond.json", "heart.json", "long.json", "oval.json", "round.json", "square.json"]);
  });
  for (const file of files) {
    it(`${file}: beklenen şekli verir`, () => {
      const fx = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as { expectedShape: string; width: number; height: number; landmarks: [number, number][] };
      const pts: Point[] = fx.landmarks.map(([x, y]) => ({ x: x * fx.width, y: y * fx.height }));
      expect(pts).toHaveLength(478);
      const m = computeMetrics(pts, null);
      expect(classifyFaceShape(m).primary).toBe(fx.expectedShape);
    });
  }
  it("SHAPE_PARAMS üretimi fixture'larla tutarlı", () => {
    for (const [name, p] of Object.entries(SHAPE_PARAMS)) {
      expect(classifyFaceShape(computeMetrics(syntheticFace(p), null)).primary).toBe(name);
    }
  });
});
