import { z } from "zod";

// SPEC 5.3 (VARSAYILAN). Mod ve alt skor PostHog bayrağıyla A/B test edilebilir.
export const TEASER_MODES = ["shape_plus_one", "overall_only", "shape_only"] as const;
export type TeaserMode = (typeof TEASER_MODES)[number];

export const SUB_KEYS = ["harmony", "eyes", "jawline", "skin", "hair", "grooming"] as const;
export type SubKey = (typeof SUB_KEYS)[number];

const TeaserEnv = z.object({
  TEASER_MODE: z.enum(TEASER_MODES).default("shape_plus_one"),
  TEASER_SUBSCORE: z.enum(SUB_KEYS).default("skin"),
});

export type TeaserConfig = { mode: TeaserMode; subscore: SubKey };

/** Geçersiz veya eksik değerde varsayılana düşer; asla fırlatmaz. */
export function getTeaserConfig(env: Record<string, string | undefined> = process.env): TeaserConfig {
  const parsed = TeaserEnv.safeParse({
    TEASER_MODE: env.TEASER_MODE || undefined,
    TEASER_SUBSCORE: env.TEASER_SUBSCORE || undefined,
  });
  const v = parsed.success ? parsed.data : TeaserEnv.parse({});
  return { mode: v.TEASER_MODE, subscore: v.TEASER_SUBSCORE };
}
