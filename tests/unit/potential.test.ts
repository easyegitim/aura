import { describe, expect, it } from "vitest";
import { calibrate } from "@/lib/score/calibration";
import { computePotential, computePotentialRaw, effectiveGain, jawlineCap, type PotentialInput } from "@/lib/score/potential";

const base: PotentialInput = {
  rawSubscores: { harmony: 6, eyes: 6, jawline: 6, skin: 6, hair: 6, grooming: 6 },
  gains: { skin: { value: 1.2, lever: "" }, hair: { value: 2.0, lever: "" }, grooming: { value: 0.8, lever: "" }, jawline: { value: 1.0, lever: "" } },
  overall: 5.5,
  bodyFatContextAllowed: false,
  beardOption: false,
  calibrate: (raw) => calibrate(raw, "v0"),
};

describe("potansiyel (SPEC 8.5)", () => {
  it("harmony ve eyes kazancı 0; tavanlar uygulanır", () => {
    expect(effectiveGain("harmony", base)).toBe(0);
    expect(effectiveGain("eyes", base)).toBe(0);
    expect(effectiveGain("hair", base)).toBe(1.5); // 2.0 → tavan 1.5
    expect(effectiveGain("skin", base)).toBe(1.2);
  });
  it("çene hattı: yağ oranı bağlamı veya sakal yoksa en çok 0,3; varsa 1,0", () => {
    expect(jawlineCap(false, false)).toBe(0.3);
    expect(jawlineCap(true, false)).toBe(1);
    expect(jawlineCap(false, true)).toBe(1);
    expect(effectiveGain("jawline", base)).toBe(0.3);
    expect(effectiveGain("jawline", { ...base, beardOption: true })).toBe(1);
  });
  it("plana bağlanmayan kazanç 0 sayılır", () => {
    expect(effectiveGain("skin", { ...base, linkedActions: { skin: [] } })).toBe(0);
    expect(effectiveGain("skin", { ...base, linkedActions: { skin: ["step_moisturizer"] } })).toBe(1.2);
  });
  it("ham potansiyel ağırlıklı toplam ve 10 tavanı", () => {
    const raw = computePotentialRaw(base);
    const expected = 0.25 * 6 + 0.15 * 6 + 0.15 * 6.3 + 0.15 * 7.2 + 0.15 * 7.5 + 0.15 * 6.8;
    expect(raw).toBeCloseTo(expected, 6);
    const high = computePotentialRaw({ ...base, rawSubscores: { harmony: 10, eyes: 10, jawline: 10, skin: 9.5, hair: 9.5, grooming: 9.5 } });
    expect(high).toBeLessThanOrEqual(10);
  });
  it("overall + 1,5 ve 9,5 üst sınırları; hiçbir zaman overall'ın altında değil", () => {
    expect(computePotential(base)).toBeLessThanOrEqual(5.5 + 1.5);
    expect(computePotential({ ...base, overall: 9.3, rawSubscores: { harmony: 9, eyes: 9, jawline: 9, skin: 9, hair: 9, grooming: 9 } })).toBe(9.5);
    expect(computePotential({ ...base, overall: 8, gains: { skin: { value: 0, lever: "" }, hair: { value: 0, lever: "" }, grooming: { value: 0, lever: "" }, jawline: { value: 0, lever: "" } } })).toBe(8);
  });
});
