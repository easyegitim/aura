"use client";

import { postJson } from "./client";
import type { GeometryResult } from "@/lib/face/types";
import type { ClientAnalysis } from "@/lib/score/present";

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) s += String.fromCharCode(...buf.subarray(i, i + chunk));
  return btoa(s);
}

/** POST /api/analyses — görsel yalnız bu isteğe gider (gizlilik testi bunu doğrular). */
export async function submitAnalysis(params: { clientRequestId: string; geometry: GeometryResult; image: Blob }): Promise<ClientAnalysis> {
  const image = await blobToBase64(params.image);
  const res = await postJson<ClientAnalysis>("/api/analyses", { clientRequestId: params.clientRequestId, geometry: params.geometry, image });
  if (!res) throw new Error("empty_response");
  return res;
}
