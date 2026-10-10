"use client";

// SPEC 10.3 adım 3: son analizdeki selfie ve landmark'lar oturum boyunca yalnız bellekte; IndexedDB'ye yazılmaz.
import type { Point } from "./types";

export type SessionSelfie = { bitmap: ImageBitmap; width: number; height: number; landmarks: Point[]; capturedAt: number };

let current: SessionSelfie | null = null;

export function setSessionSelfie(s: SessionSelfie | null) {
  if (current && current !== s) current.bitmap.close();
  current = s;
}
export function getSessionSelfie(): SessionSelfie | null {
  return current;
}
