// SPEC 7.4: saç çizgisi ağda yoktur. Segmenter maskesinde 9 → 10 doğrultusu boyunca yukarı çıkılır;
// yüz cildinin bittiği, saç/arka planın başladığı ilk nokta saç çizgisidir.
import { IDX } from "./indices";
import { SEG_CLASS, type Point, type SegmentationResult } from "./types";

export type HairlineResult = { found: boolean; point: Point | null };

/**
 * @param landmarksPx Kare piksel koordinatında noktalar.
 * @param frame Kare boyutu (noktaların uzayı).
 * @param seg Segmenter maskesi (kendi boyutunda; ölçeklenir).
 */
export function findHairline(
  landmarksPx: Point[],
  frame: { width: number; height: number },
  seg: SegmentationResult,
): HairlineResult {
  const g = landmarksPx[IDX.glabella];
  const top = landmarksPx[IDX.top];
  const dirX = top.x - g.x;
  const dirY = top.y - g.y;
  const len = Math.hypot(dirX, dirY);
  if (len === 0) return { found: false, point: null };
  const ux = dirX / len;
  const uy = dirY / len;
  const sx = seg.width / frame.width;
  const sy = seg.height / frame.height;
  const classAt = (p: Point): number | null => {
    const mx = Math.floor(p.x * sx); // piksel [y, y+1) aralığını kapsar
    const my = Math.floor(p.y * sy);
    if (mx < 0 || my < 0 || mx >= seg.width || my >= seg.height) return null;
    return seg.mask[my * seg.width + mx];
  };

  // Yüz yüksekliğinin 1,2 katına kadar yukarı ara (alın + saç).
  const faceHeight = Math.hypot(landmarksPx[IDX.menton].x - top.x, landmarksPx[IDX.menton].y - top.y);
  const maxSteps = Math.ceil(faceHeight * 1.2);
  let seenFace = false;
  for (let s = 0; s <= maxSteps; s++) {
    const p = { x: g.x + ux * s, y: g.y + uy * s };
    const c = classAt(p);
    if (c === null) return { found: false, point: null }; // görüntü dışına çıktı
    if (c === SEG_CLASS.faceSkin || c === SEG_CLASS.bodySkin) {
      seenFace = true;
      continue;
    }
    if (!seenFace) continue; // henüz yüz cildine girilmedi (ör. kaş bölgesi 'diğer')
    if (c === SEG_CLASS.hair || c === SEG_CLASS.background) return { found: true, point: p };
    if (c === SEG_CLASS.other || c === SEG_CLASS.clothes) return { found: false, point: null }; // şapka/aksesuar
  }
  return { found: false, point: null };
}
