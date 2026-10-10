// SPEC 10.4 adım 3: koruma maskesi M (C koordinatlarında). 255 = kullanıcının orijinal pikseli korunur.
import { FACE_OVAL, IDX } from "@/lib/face/indices";
import type { Point } from "@/lib/face/types";
import type { Protect } from "@/content/types";

export const FEATHER_PX = 10;
export const BROW_MARGIN_PX = 4;

/** Nokta poligonun içinde mi (even-odd). */
export function pointInPolygon(x: number, y: number, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Yüz ovali poligonu (SPEC 7.4 sırası). */
export function faceOvalPolygon(L: Point[]): Point[] {
  return FACE_OVAL.map((i) => L[i]);
}

/**
 * Keskin maske (0/255):
 * - below_brows: yüz ovali, üst sınırı kaş üstü çizgisinin (105, 334) 4 px üstünde kesilir (alın modele kalır).
 * - above_lip: kaş üstünden burun altına (2) kadar, yüz ovali içinde (alt yüz modele kalır).
 */
export function rasterizeMask(L: Point[], width: number, height: number, protect: Protect): Uint8ClampedArray {
  const mask = new Uint8ClampedArray(width * height);
  const poly = faceOvalPolygon(L);
  const browTop = Math.min(L[IDX.browTopR].y, L[IDX.browTopL].y) - BROW_MARGIN_PX;
  const lipTop = L[IDX.subnasale].y;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const y0 = Math.max(0, Math.floor(protect === "below_brows" ? Math.max(minY, browTop) : Math.max(minY, browTop)));
  const y1 = Math.min(height - 1, Math.ceil(protect === "below_brows" ? maxY : Math.min(maxY, lipTop)));
  const x0 = Math.max(0, Math.floor(minX)), x1 = Math.min(width - 1, Math.ceil(maxX));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (pointInPolygon(x + 0.5, y + 0.5, poly)) mask[y * width + x] = 255;
    }
  }
  return mask;
}

/** Ayrılabilir kutu bulanıklığı ×3 ≈ Gauss (SPEC: 10 px yumuşatma). */
export function feather(mask: Uint8ClampedArray, width: number, height: number, radius = FEATHER_PX): Uint8ClampedArray {
  let src = Float32Array.from(mask);
  const r = Math.max(1, Math.round(radius / 2));
  for (let pass = 0; pass < 3; pass++) {
    const tmp = new Float32Array(width * height);
    // yatay
    for (let y = 0; y < height; y++) {
      let acc = 0;
      const row = y * width;
      for (let x = -r; x <= r; x++) acc += src[row + clamp(x, 0, width - 1)];
      for (let x = 0; x < width; x++) {
        tmp[row + x] = acc / (2 * r + 1);
        acc += src[row + clamp(x + r + 1, 0, width - 1)] - src[row + clamp(x - r, 0, width - 1)];
      }
    }
    // dikey
    const out = new Float32Array(width * height);
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, height - 1) * width + x];
      for (let y = 0; y < height; y++) {
        out[y * width + x] = acc / (2 * r + 1);
        acc += tmp[clamp(y + r + 1, 0, height - 1) * width + x] - tmp[clamp(y - r, 0, height - 1) * width + x];
      }
    }
    src = out;
  }
  return Uint8ClampedArray.from(src, (v) => Math.round(v));
}

export function buildProtectMask(L: Point[], width: number, height: number, protect: Protect): Uint8ClampedArray {
  return feather(rasterizeMask(L, width, height, protect), width, height);
}

/** Maske kenarındaki bant (SPEC 10.4 adım 5, 12 px): 0 < M < 255 olan pikseller. */
export function edgeBand(mask: Uint8ClampedArray): Uint32Array {
  const idx: number[] = [];
  for (let i = 0; i < mask.length; i++) if (mask[i] > 8 && mask[i] < 247) idx.push(i);
  return Uint32Array.from(idx);
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
