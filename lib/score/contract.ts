// hybrid.v1 istemci sözlüğü (UI spec §1.1, engine spec §7.3/§8, sözleşme C5). Saf, paylaşılan, mobilden içe aktarılabilir.
// Yalnız sözlük: eşik, bant, delta veya ağırlık burada yok (bunlar server-only motor dosyalarında).
// Motor analyses.signals'ın istemciye giden kısmını tam bu biçimde yazar; bu tipleri yeniden tanımlamaz.
import { z } from "zod";
import { SUB_KEYS, type SubKey } from "@/lib/config/teaser";

export const ENGINE_NAMES = ["hybrid.v1", "legacy"] as const;
export type EngineName = (typeof ENGINE_NAMES)[number];

export const MOD_SUBS = ["skin", "hair", "grooming"] as const;
export type ModSub = (typeof MOD_SUBS)[number];

export type SubKind = "structural" | "partial" | "modifiable";

/** Motorun 9 kaldıracı (engine spec §6.4). Anahtar sırası = "önce odaklan" eşitlik sırası. */
export const LEVER_SUB = {
  lv_blemish_care: "skin",
  lv_texture_smooth: "skin",
  lv_daily_spf: "skin",
  lv_shine_balance: "skin",
  lv_hair_styling: "hair",
  lv_haircut_refresh: "hair",
  lv_brow_tidy: "grooming",
  lv_lip_care: "grooming",
  lv_beard_lineup: "grooming",
} as const satisfies Record<string, ModSub>;
export type LeverKey = keyof typeof LEVER_SUB;
export const LEVER_KEYS = Object.keys(LEVER_SUB) as LeverKey[];
export const BEARD_LEVERS: readonly LeverKey[] = ["lv_beard_lineup"];

export const STRUCTURAL_EXPLAIN_KEYS = ["symmetry", "vertical", "eyeMouth", "spacing", "tilt", "jawWidth"] as const;
/** evenness gözlenir ama puanlanmaz; açıklama öğesi yoktur. */
export const MOD_EXPLAIN_KEYS = ["blemishes", "texture", "shine", "hairNeat", "hairShape", "brows", "lips", "facialHairEdges"] as const;
export type StructuralExplainKey = (typeof STRUCTURAL_EXPLAIN_KEYS)[number];
export type ModExplainKey = (typeof MOD_EXPLAIN_KEYS)[number];
/** Yapısal öğeler yalnız ölçüldü/ölçülmedi taşır; hiçbir yapısal durum yüzü yargılamaz. */
export type ExplainItem =
  | { key: StructuralExplainKey; status: "measured" | "not_measured" }
  | { key: ModExplainKey; status: "best" | "partial" | "unclear" };

/** Saç ipucu yoktur (hiçbir metin örtülü saçı göstermeyi istemez). */
export const CAPTURE_HINTS = ["lighting", "pose", "skin_visibility", "retouch"] as const;
export type CaptureHint = (typeof CAPTURE_HINTS)[number];

/** excluded: beyan edilen başörtüsü veya başta görünür saç yok (ağırlık 0; herkese açık).
 *  not_visible: bu çekimde görünmedi (referansla doldurulur; yalnız alt skor açıksa gösterilir). */
export const NOT_ASSESSED_REASONS = ["excluded", "not_visible"] as const;
export type NotAssessedReason = (typeof NOT_ASSESSED_REASONS)[number];
export type NotAssessed = { sub: ModSub; reason: NotAssessedReason };

/** gain: genel skor puanı, 1 ondalık, > 0. */
export type ImproveItem = { sub: ModSub; lever: LeverKey; gain: number };

const ExplainItemSchema = z.union([
  z.object({ key: z.enum(STRUCTURAL_EXPLAIN_KEYS), status: z.enum(["measured", "not_measured"]) }),
  z.object({ key: z.enum(MOD_EXPLAIN_KEYS), status: z.enum(["best", "partial", "unclear"]) }),
]);

/** analyses.signals'ın istemciyle ilgili kısmı (SignalsV1 bunu genişletir); present.ts'te ayrıştırılır. Bilinmeyen anahtarlar atılır. */
export const ClientSignals = z.object({
  engine: z.literal("hybrid.v1"),
  improveFirst: z
    .array(
      z.object({
        sub: z.enum(MOD_SUBS),
        lever: z.enum(LEVER_KEYS as [LeverKey, ...LeverKey[]]),
        gain: z.number().positive().max(2),
      }),
    )
    .max(3),
  explain: z.partialRecord(z.enum(SUB_KEYS), z.array(ExplainItemSchema).max(8)),
  notAssessed: z.array(z.object({ sub: z.enum(MOD_SUBS), reason: z.enum(NOT_ASSESSED_REASONS) })),
  captureHints: z.array(z.enum(CAPTURE_HINTS)),
});
export type ClientSignals = z.infer<typeof ClientSignals>;

export function isModSub(k: SubKey): k is ModSub {
  return (MOD_SUBS as readonly string[]).includes(k);
}
