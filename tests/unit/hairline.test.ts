import { describe, expect, it } from "vitest";
import { findHairline } from "@/lib/face/hairline";
import { IDX } from "@/lib/face/indices";
import { SEG_CLASS, type SegmentationResult } from "@/lib/face/types";
import { syntheticFace } from "../helpers/syntheticFace";

const W = 200, H = 200;
const face = syntheticFace({ cheek: 80, length: 110, jaw: 66, forehead: 70, cx: 100, cy: 110 });
// glabella y ≈ 110 − 24.2 = 85.8; top y ≈ 60.5

/** Maske: belirtilen y'nin altı yüz cildi, üstü verilen sınıf. */
function mask(hairFromY: number, aboveClass: number, scale = 1): SegmentationResult {
  const w = Math.round(W * scale), h = Math.round(H * scale);
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = y / scale < hairFromY ? aboveClass : SEG_CLASS.faceSkin;
  return { width: w, height: h, mask: m };
}

describe("findHairline (SPEC 7.4)", () => {
  it("yüz cildinden saça geçilen ilk noktayı bulur", () => {
    const r = findHairline(face, { width: W, height: H }, mask(70, SEG_CLASS.hair));
    expect(r.found).toBe(true);
    expect(r.point!.y).toBeCloseTo(69.5, 0);
    expect(r.point!.x).toBeCloseTo(face[IDX.glabella].x, 5);
  });
  it("saç yoksa arka plana geçiş de saç çizgisi sayılır (kel)", () => {
    const r = findHairline(face, { width: W, height: H }, mask(60, SEG_CLASS.background));
    expect(r.found).toBe(true);
    expect(r.point!.y).toBeCloseTo(59.5, 0);
  });
  it("şapka/aksesuar (diğer) → bulunamadı", () => {
    expect(findHairline(face, { width: W, height: H }, mask(70, SEG_CLASS.other)).found).toBe(false);
  });
  it("maske farklı çözünürlükte olsa da kare koordinatında döner", () => {
    const r = findHairline(face, { width: W, height: H }, mask(70, SEG_CLASS.hair, 0.5));
    expect(r.found).toBe(true);
    expect(Math.abs(r.point!.y - 70)).toBeLessThan(3);
  });
  it("arama görüntü dışına çıkarsa bulunamadı", () => {
    const all = { width: W, height: H, mask: new Uint8Array(W * H).fill(SEG_CLASS.faceSkin) };
    expect(findHairline(face, { width: W, height: H }, all).found).toBe(false);
  });
});
