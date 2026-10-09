import { describe, expect, it } from "vitest";
import { QUALITY_CONFIG, checkQuality, faceBox } from "@/lib/face/quality";
import type { FrameAnalysis, Point } from "@/lib/face/types";

/** Merkezde, genişliği w olan dikdörtgen "yüz" noktaları. */
function fakeFace(w = 0.5, cx = 0.5, cy = 0.5): Point[] {
  const h = w * 1.3;
  return [
    { x: cx - w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy - h / 2 },
    { x: cx - w / 2, y: cy + h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
    { x: cx, y: cy },
  ];
}

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function frame(over: Partial<FrameAnalysis> = {}): FrameAnalysis {
  return {
    width: 720,
    height: 960,
    faces: 1,
    landmarks: fakeFace(),
    blendshapes: { eyeBlinkLeft: 0.1, eyeBlinkRight: 0.1, mouthSmileLeft: 0.1, mouthSmileRight: 0.1, jawOpen: 0.05 },
    matrix: identity,
    brightness: 140,
    brightnessBalance: 10,
    sharpness: 120,
    hairVisible: true,
    timestamp: 0,
    ...over,
  };
}

describe("checkQuality (SPEC 7.3)", () => {
  it("iyi kare geçer", () => {
    const r = checkQuality(frame());
    expect(r.passed).toBe(true);
    expect(r.issues).toEqual([]);
  });
  it("yüz yok / iki yüz", () => {
    expect(checkQuality(frame({ faces: 0, landmarks: null })).issues).toEqual(["no_face"]);
    expect(checkQuality(frame({ faces: 2 })).issues).toEqual(["multiple_faces"]);
  });
  it("uzak / yakın / merkez dışı", () => {
    expect(checkQuality(frame({ landmarks: fakeFace(0.3) })).issues).toContain("too_far");
    expect(checkQuality(frame({ landmarks: fakeFace(0.8) })).issues).toContain("too_close");
    expect(checkQuality(frame({ landmarks: fakeFace(0.5, 0.7, 0.5) })).issues).toContain("off_center");
  });
  it("ışık, denge, netlik", () => {
    expect(checkQuality(frame({ brightness: 60 })).issues).toContain("too_dark");
    expect(checkQuality(frame({ brightness: 220 })).issues).toContain("too_bright");
    expect(checkQuality(frame({ brightnessBalance: 40 })).issues).toContain("uneven_light");
    expect(checkQuality(frame({ sharpness: 30 })).issues).toContain("blurry");
  });
  it("gözler kapalı ve nötr olmayan ifade", () => {
    expect(checkQuality(frame({ blendshapes: { eyeBlinkLeft: 0.6, eyeBlinkRight: 0.1, mouthSmileLeft: 0, mouthSmileRight: 0, jawOpen: 0 } })).issues).toContain("eyes_closed");
    expect(checkQuality(frame({ blendshapes: { eyeBlinkLeft: 0, eyeBlinkRight: 0, mouthSmileLeft: 0.5, mouthSmileRight: 0.1, jawOpen: 0 } })).issues).toContain("not_neutral");
    expect(checkQuality(frame({ blendshapes: { eyeBlinkLeft: 0, eyeBlinkRight: 0, mouthSmileLeft: 0, mouthSmileRight: 0, jawOpen: 0.3 } })).issues).toContain("not_neutral");
  });
  it("baş açısı: 10° yaw engeller (eşik 8°)", () => {
    const rad = (10 * Math.PI) / 180;
    // yalnız yaw: sütun-öncelikli Ry
    const m = [Math.cos(rad), 0, -Math.sin(rad), 0, 0, 1, 0, 0, Math.sin(rad), 0, Math.cos(rad), 0, 0, 0, 0, 1];
    const r = checkQuality(frame({ matrix: m }));
    expect(r.issues).toContain("head_angle");
    expect(Math.abs(r.measures.yaw ?? 0)).toBeCloseTo(10, 3);
  });
  it("saç görünmüyorsa yalnız uyarı, engel değil", () => {
    const r = checkQuality(frame({ hairVisible: false }));
    expect(r.passed).toBe(true);
    expect(r.warnings).toEqual(["hair_not_visible"]);
  });
  it("ölçüm eksikse (null) o kontrol atlanır", () => {
    expect(checkQuality(frame({ brightness: null, sharpness: null, matrix: null, blendshapes: null, hairVisible: null })).passed).toBe(true);
  });
  it("faceBox normalize kutu döndürür", () => {
    const b = faceBox(fakeFace(0.4));
    expect(b.width).toBeCloseTo(0.4);
    expect(b.cx).toBeCloseTo(0.5);
  });
  it("yapılandırma değerleri SPEC 7.3 başlangıç eşikleri", () => {
    expect(QUALITY_CONFIG.yawMaxDeg).toBe(8);
    expect(QUALITY_CONFIG.sharpnessMin).toBe(60);
    expect(QUALITY_CONFIG.stableMs).toBe(600);
  });
});
