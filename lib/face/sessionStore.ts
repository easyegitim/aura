"use client";

// SPEC 10.3 adım 3: son analizdeki selfie ve landmark'lar oturum boyunca yalnız bellekte; IndexedDB'ye yazılmaz.
import type { Point } from "./types";

export type SessionSelfie = {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  landmarks: Point[];
  capturedAt: number;
  /** Bu selfie'nin bağlandığı analiz (UI spec S1); katman yalnız eşleşen analizde fotoğraf üzerine çizilir. */
  analysisId?: string;
};

let current: SessionSelfie | null = null;

export function setSessionSelfie(s: SessionSelfie | null) {
  if (current && current !== s) current.bitmap.close();
  current = s;
}
export function getSessionSelfie(): SessionSelfie | null {
  return current;
}
/** Selfie'yi analize bağlar; yalnız bellekteki selfie hâlâ aynı çekimse (capturedAt eşleşirse). */
export function bindSessionSelfie(analysisId: string, capturedAt: number): void {
  if (current && current.capturedAt === capturedAt) current.analysisId = analysisId;
}
