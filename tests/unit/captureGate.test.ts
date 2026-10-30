import { describe, expect, it } from "vitest";
import { classifyFaceShape } from "@/lib/face/faceShape";
import { checkServerCapture, withServerFaceShape } from "@/lib/score/engine/captureGate";
import { GEO, geo } from "../helpers/engineFixtures";

describe("sunucu çekim kapısı (engine spec §3.6)", () => {
  it("iyi çekim geçer", () => {
    expect(checkServerCapture(GEO).ok).toBe(true);
  });

  it("poz sınırları: |yaw| > 12, |pitch| > 15, |roll| > 10 reddedilir; sınırda geçer", () => {
    expect(checkServerCapture(geo({ quality: { yaw: 12, pitch: -15, roll: 10 } })).ok).toBe(true);
    expect(checkServerCapture(geo({ quality: { yaw: -12.1 } }))).toEqual({ ok: false, reason: "pose" });
    expect(checkServerCapture(geo({ quality: { pitch: 15.5 } }))).toEqual({ ok: false, reason: "pose" });
    expect(checkServerCapture(geo({ quality: { roll: -11 } }))).toEqual({ ok: false, reason: "pose" });
    expect(checkServerCapture(geo({ quality: { yaw: Number.NaN } }))).toEqual({ ok: false, reason: "pose" });
  });

  it("brightness 0 ve sharpness 0 bilinmiyor sayılır (geçer); 50 ve 30 reddedilir", () => {
    expect(checkServerCapture(geo({ quality: { brightness: 0, sharpness: 0 } })).ok).toBe(true);
    expect(checkServerCapture(geo({ quality: { brightness: 50 } }))).toEqual({ ok: false, reason: "light" });
    expect(checkServerCapture(geo({ quality: { brightness: 230 } }))).toEqual({ ok: false, reason: "light" });
    expect(checkServerCapture(geo({ quality: { brightness: 55, sharpness: 35 } })).ok).toBe(true);
    expect(checkServerCapture(geo({ quality: { sharpness: 30 } }))).toEqual({ ok: false, reason: "blur" });
  });

  it("yanlış yüz şekli reddedilmez, sunucu hesabıyla değiştirilir (face_shape ve geometry.faceShape aynı)", () => {
    const tampered = { ...GEO, faceShape: { primary: "diamond" as const, confidence: 1 } };
    const r = checkServerCapture(tampered);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.faceShape).toEqual(classifyFaceShape(GEO.metrics));
    const stored = withServerFaceShape(tampered, r.faceShape);
    expect(stored.faceShape).toEqual(r.faceShape);
    expect(stored.metrics).toBe(tampered.metrics);
  });

  it("üçte bir toplamı kontrolü yok: tutarsız üçte birler reddedilmez", () => {
    expect(checkServerCapture(geo({ metrics: { thirds: { upper: 0.6, middle: 0.6, lower: 0.6 }, lowerToMiddle: 3 } })).ok).toBe(true);
  });
});
