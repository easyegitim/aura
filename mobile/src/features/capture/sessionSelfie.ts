// SPEC 10.3 adım 3: selfie + landmark'lar oturum boyunca yalnız bellekte/önbellekte (kalıcı depoya yazılmaz; ağa gitmez).
import type { Point } from "@/lib/face/types";

export type SessionSelfie = { uri: string; width: number; height: number; landmarksPx: Point[]; capturedAt: number };

let current: SessionSelfie | null = null;

export function setSessionSelfie(s: SessionSelfie | null): void {
  current = s;
}
export function getSessionSelfie(): SessionSelfie | null {
  return current;
}
