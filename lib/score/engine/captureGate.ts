import "server-only";

import { SERVER_CAPTURE_GATE } from "@/lib/config/engine.server";
import { classifyFaceShape } from "@/lib/face/faceShape";
import type { GeometryResult } from "@/lib/face/types";

// engine spec §3.6: reserve_analysis'ten ÖNCE çalışan sunucu çekim kapısı (hak düşmez; rota CAPTURE_QUALITY 422 döner).
// İstemci kapısından geniştir; yalnız kurcalanmış veya eski çekimleri durdurur. brightness ten rengine bağlı yüz kırpımı
// parlaklığıdır: yalnız kapıdır, hiçbir skora girmez. 0 = bilinmiyor (eski istemci / ölçüm yok). Üçte bir toplamı veya
// L2M yeniden türetme kontrolü YOK (geçerli çekimleri reddederdi). Yüz şekli yeniden hesaplanır, asla reddedilmez.

export type CaptureGateResult = { ok: true; faceShape: GeometryResult["faceShape"] } | { ok: false; reason: "pose" | "light" | "blur" };

export function checkServerCapture(g: GeometryResult): CaptureGateResult {
  const q = g.quality;
  const G = SERVER_CAPTURE_GATE;
  const finite = (v: number) => Number.isFinite(v);
  if (!finite(q.yaw) || !finite(q.pitch) || !finite(q.roll)) return { ok: false, reason: "pose" };
  if (Math.abs(q.yaw) > G.yawMax || Math.abs(q.pitch) > G.pitchMax || Math.abs(q.roll) > G.rollMax) return { ok: false, reason: "pose" };
  if (q.brightness > 0 && (q.brightness < G.brightness[0] || q.brightness > G.brightness[1])) return { ok: false, reason: "light" };
  if (q.sharpness > 0 && q.sharpness < G.sharpnessMin) return { ok: false, reason: "blur" };
  return { ok: true, faceShape: classifyFaceShape(g.metrics) };
}

/** Rotanın satıra yazacağı geometri: geometry.faceShape sunucu hesabıyla değiştirilir (face_shape sütunuyla aynı). */
export function withServerFaceShape(g: GeometryResult, faceShape: GeometryResult["faceShape"]): GeometryResult {
  return { ...g, faceShape };
}
