import { z } from "zod";
import { SERVER_IMAGE_MAX_BYTES } from "@/lib/face/crop";

// SPEC 7.7 GeometryResult şeması (ham nokta dizisi kabul edilmez).
const FaceShape = z.enum(["oval", "round", "square", "long", "heart", "diamond"]);
export const GeometrySchema = z.object({
  version: z.literal("geo-v1"),
  quality: z.object({
    yaw: z.number(),
    pitch: z.number(),
    roll: z.number(),
    brightness: z.number(),
    sharpness: z.number(),
    passed: z.boolean(),
  }),
  metrics: z.object({
    lengthRatio: z.number().min(0.5).max(3),
    jawRatio: z.number().min(0.2).max(2),
    foreheadRatio: z.number().min(0.2).max(2),
    fwhr: z.number().min(0.5).max(4),
    canthalTiltDeg: z.number().min(-45).max(45),
    lowerToMiddle: z.number().min(0.2).max(4),
    thirds: z.object({ upper: z.number().nullable(), middle: z.number(), lower: z.number() }),
    hairlineFound: z.boolean(),
  }),
  faceShape: z.object({ primary: FaceShape, secondary: FaceShape.optional(), confidence: z.number().min(0).max(1) }),
  capturedAt: z.string(),
});

export const AnalysisInput = z.object({
  clientRequestId: z.uuid(),
  geometry: GeometrySchema,
  /** base64 JPEG (data: öneki olmadan). */
  image: z.string().min(100).max(Math.ceil((SERVER_IMAGE_MAX_BYTES * 4) / 3) + 4),
});
export type AnalysisInput = z.infer<typeof AnalysisInput>;

/** Base64'ü çözer, JPEG imzasını (FF D8 FF) ve boyutu doğrular. Hata kodu döner. */
export function decodeJpeg(base64: string): { bytes: Buffer } | { error: "IMAGE_TOO_LARGE" | "BAD_INPUT" } {
  let bytes: Buffer;
  try {
    bytes = Buffer.from(base64, "base64");
  } catch {
    return { error: "BAD_INPUT" };
  }
  if (bytes.length > SERVER_IMAGE_MAX_BYTES) return { error: "IMAGE_TOO_LARGE" };
  if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return { error: "BAD_INPUT" };
  return { bytes };
}
