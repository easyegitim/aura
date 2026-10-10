// SPEC 10.4 adım 1–5 ve 10.5 kontrolleri. Worker'da OffscreenCanvas ile çalışır; ana iş parçacığında da kullanılabilir.
import type { Protect } from "@/content/types";
import { ALIGN_POINTS, IDX } from "@/lib/face/indices";
import { computeMetrics, rollCorrect } from "@/lib/face/metrics";
import type { Point } from "@/lib/face/types";
import { alignmentResidual, estimateSimilarity, type Similarity } from "./align";
import { buildProtectMask, edgeBand } from "./mask";

export const TRYON_LIMITS = {
  /** Hizalama artığı / göz bebekleri arası mesafe (SPEC 10.5). */
  maxResidual: 0.04,
  /** lengthRatio ve jawRatio sapması (SPEC 10.5). */
  maxGeometryDrift: 0.03,
  /** Kenar bandında parlaklık farkı eşiği (SPEC 10.4 adım 5). */
  edgeLumaDiff: 18,
  edgeBandPx: 12,
} as const;

export type CompositeInput = {
  /** Kullanıcının 1024 px kare kırpımı C. */
  c: ImageBitmap;
  /** Modelin ürettiği görsel G (herhangi boyut; C boyutuna ölçeklenir). */
  g: ImageBitmap;
  /** C üzerindeki noktalar (piksel). */
  landmarksC: Point[];
  /** G üzerindeki noktalar (G'nin kendi piksel uzayında; Face Landmarker ile bulunur). */
  landmarksG: Point[];
  protect: Protect;
};

export type CompositeResult = {
  image: ImageBitmap;
  residual: number;
  transform: Similarity;
  edgeLumaDiff: number;
  toneAdjusted: boolean;
};

export class CompositeError extends Error {
  constructor(readonly reason: "no_face_in_output" | "alignment_residual" | "canvas") {
    super(reason);
  }
}

function luma(d: Uint8ClampedArray, i: number) {
  return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
}

export async function compositeTryon(input: CompositeInput): Promise<CompositeResult> {
  const W = input.c.width, H = input.c.height;
  // 1) G, C boyutuna ölçeklenir; G noktaları da aynı ölçekle.
  const sx = W / input.g.width, sy = H / input.g.height;
  const LG = input.landmarksG.map((p) => ({ x: p.x * sx, y: p.y * sy }));
  const LC = input.landmarksC;

  // 2) Benzerlik dönüşümü L_G → L_C (sabit noktalar), artık kontrolü.
  const src = ALIGN_POINTS.map((i) => LG[i]);
  const dst = ALIGN_POINTS.map((i) => LC[i]);
  const t = estimateSimilarity(src, dst);
  const ipd = Math.hypot(LC[IDX.irisR].x - LC[IDX.irisL].x, LC[IDX.irisR].y - LC[IDX.irisL].y);
  const residual = alignmentResidual(t, src, dst, ipd);
  if (!(residual < TRYON_LIMITS.maxResidual)) throw new CompositeError("alignment_residual");

  const canvasG = new OffscreenCanvas(W, H);
  const ctxG = canvasG.getContext("2d", { willReadFrequently: true });
  const canvasC = new OffscreenCanvas(W, H);
  const ctxC = canvasC.getContext("2d", { willReadFrequently: true });
  if (!ctxG || !ctxC) throw new CompositeError("canvas");
  // G' = hizalanmış G: önce C boyutuna ölçekle, sonra benzerlik dönüşümü.
  ctxG.setTransform(t.a, t.b, -t.b, t.a, t.tx, t.ty);
  ctxG.drawImage(input.g, 0, 0, W, H);
  ctxG.setTransform(1, 0, 0, 1, 0, 0);
  ctxC.drawImage(input.c, 0, 0);
  const gp = ctxG.getImageData(0, 0, W, H);
  const cp = ctxC.getImageData(0, 0, W, H);

  // 3) Maske (10 px yumuşatma).
  const mask = buildProtectMask(LC, W, H, input.protect);

  // 5) Renk geçişi: kenar bandında ortalama parlaklık farkı > 18 ise G' maske dışında ton düzeltmesi.
  const band = edgeBand(mask);
  let sumG = 0, sumC = 0;
  for (const i of band) {
    sumG += luma(gp.data, i * 4);
    sumC += luma(cp.data, i * 4);
  }
  const edgeLumaDiff = band.length ? Math.abs(sumG - sumC) / band.length : 0;
  let toneAdjusted = false;
  if (edgeLumaDiff > TRYON_LIMITS.edgeLumaDiff && band.length) {
    const gain = Math.min(1.25, Math.max(0.8, sumC / Math.max(1, sumG)));
    for (let i = 0; i < gp.data.length; i += 4) {
      if (mask[i >> 2] === 255) continue;
      gp.data[i] = Math.min(255, gp.data[i] * gain);
      gp.data[i + 1] = Math.min(255, gp.data[i + 1] * gain);
      gp.data[i + 2] = Math.min(255, gp.data[i + 2] * gain);
    }
    toneAdjusted = true;
  }

  // 4) Çıktı = G' × (1 − M) + C × M — maskede 255 olan pikseller C'den birebir (piksel farkı 0).
  const out = ctxC.createImageData(W, H);
  for (let p = 0; p < W * H; p++) {
    const m = mask[p] / 255;
    const i = p * 4;
    if (m === 1) {
      out.data[i] = cp.data[i]; out.data[i + 1] = cp.data[i + 1]; out.data[i + 2] = cp.data[i + 2];
    } else if (m === 0) {
      out.data[i] = gp.data[i]; out.data[i + 1] = gp.data[i + 1]; out.data[i + 2] = gp.data[i + 2];
    } else {
      out.data[i] = gp.data[i] * (1 - m) + cp.data[i] * m;
      out.data[i + 1] = gp.data[i + 1] * (1 - m) + cp.data[i + 1] * m;
      out.data[i + 2] = gp.data[i + 2] * (1 - m) + cp.data[i + 2] * m;
    }
    out.data[i + 3] = 255;
  }
  ctxC.putImageData(out, 0, 0);
  const image = canvasC.transferToImageBitmap();
  return { image, residual, transform: t, edgeLumaDiff, toneAdjusted };
}

/** SPEC 10.5: kompozit sonrası tekrar landmark; lengthRatio ve jawRatio orijinalden %3'ten fazla sapmamalı. */
export function geometryDrift(landmarksOriginal: Point[], landmarksComposite: Point[]): { length: number; jaw: number; ok: boolean } {
  const a = computeMetrics(rollCorrect(landmarksOriginal).points, null);
  const b = computeMetrics(rollCorrect(landmarksComposite).points, null);
  const length = Math.abs(b.lengthRatio - a.lengthRatio) / a.lengthRatio;
  const jaw = Math.abs(b.jawRatio - a.jawRatio) / a.jawRatio;
  return { length, jaw, ok: length <= TRYON_LIMITS.maxGeometryDrift && jaw <= TRYON_LIMITS.maxGeometryDrift };
}

/** "Yapay zekâ ile oluşturuldu" etiketini görsele gömer (SPEC 10.7 indirme). */
export async function stampAiLabel(image: ImageBitmap, label: string): Promise<Blob> {
  const canvas = new OffscreenCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CompositeError("canvas");
  ctx.drawImage(image, 0, 0);
  const fontPx = Math.max(14, Math.round(image.width * 0.028));
  ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
  const padding = Math.round(fontPx * 0.6);
  const textW = ctx.measureText(label).width;
  const x = image.width - textW - padding * 2 - fontPx, y = image.height - fontPx * 2 - padding;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x, y, textW + padding * 2, fontPx + padding);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "top";
  ctx.fillText(label, x + padding, y + padding / 2);
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
}
