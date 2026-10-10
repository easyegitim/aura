import { z } from "zod";
import { ALL_PRESETS } from "@/content/presets";

/** SPEC 14: JPEG ≤ 1,5 MB; geçerli preset. */
export const TRYON_IMAGE_MAX_BYTES = 1.5 * 1024 * 1024;
const PRESET_IDS = ALL_PRESETS.map((p) => p.id) as [string, ...string[]];

export const TryonInput = z.object({
  clientRequestId: z.uuid(),
  presetId: z.enum(PRESET_IDS),
  /** base64 JPEG, 1024 px kare kırpım. */
  image: z.string().min(100).max(Math.ceil((TRYON_IMAGE_MAX_BYTES * 4) / 3) + 4),
  /** TRYON_PROVIDER=fal için istemcide segmenter saç sınıfından üretilen maske (base64 PNG), isteğe bağlı. */
  mask: z.string().max(Math.ceil((TRYON_IMAGE_MAX_BYTES * 4) / 3) + 4).optional(),
});
export type TryonInput = z.infer<typeof TryonInput>;

export function decodeJpegLimited(base64: string, maxBytes: number): { bytes: Buffer } | { error: "IMAGE_TOO_LARGE" | "BAD_INPUT" } {
  let bytes: Buffer;
  try {
    bytes = Buffer.from(base64, "base64");
  } catch {
    return { error: "BAD_INPUT" };
  }
  if (bytes.length > maxBytes) return { error: "IMAGE_TOO_LARGE" };
  if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return { error: "BAD_INPUT" };
  return { bytes };
}
