// Cilt adımı türleri: marka değil ürün türü (SPEC 9.8 kural 9). İlaç/reçeteli etken madde yok.
export type SkinStep = {
  id: string;
  nameTr: string;
  noteTr: string;
  slot: "morning" | "evening" | "weekly";
  budget: "low" | "medium" | "high";
  minutes: number;
  /** Uygun cilt tipleri; boş = hepsi. */
  skinTypes: Array<"oily" | "dry" | "combination" | "normal" | "sensitive" | "unknown">;
};

export const SKIN_STEPS: SkinStep[] = [
  { id: "st_cleanser_gentle", nameTr: "Nazik temizleyici (jel/köpük olmayan)", noteTr: "Sabah ve akşam; sıcak değil ılık su", slot: "morning", budget: "low", minutes: 1, skinTypes: ["dry", "sensitive", "normal", "unknown"] },
  { id: "st_cleanser_foaming", nameTr: "Köpüren temizleyici", noteTr: "Yağlı ve karma ciltte fazla yağı alır", slot: "morning", budget: "low", minutes: 1, skinTypes: ["oily", "combination"] },
  { id: "st_cleanser_evening", nameTr: "Akşam temizliği", noteTr: "Gün sonunda kir ve güneş kremini çıkarır", slot: "evening", budget: "low", minutes: 1, skinTypes: [] },
  { id: "st_moisturizer_light", nameTr: "Hafif nemlendirici (jel)", noteTr: "Yağsız; parlama yapmaz", slot: "morning", budget: "low", minutes: 1, skinTypes: ["oily", "combination", "normal", "unknown"] },
  { id: "st_moisturizer_rich", nameTr: "Yoğun nemlendirici (krem)", noteTr: "Kuru ve hassas cilt için", slot: "evening", budget: "low", minutes: 1, skinTypes: ["dry", "sensitive", "normal"] },
  { id: "st_spf", nameTr: "Güneş koruyucu SPF 30+", noteTr: "Her sabah, bulutlu günlerde de; en etkili tek adım", slot: "morning", budget: "low", minutes: 1, skinTypes: [] },
  { id: "st_exfoliant_weekly", nameTr: "Haftalık nazik peeling (yüz yıkama tipi)", noteTr: "Haftada 1; hassas ciltte atla", slot: "weekly", budget: "medium", minutes: 3, skinTypes: ["oily", "combination", "normal", "unknown"] },
  { id: "st_clay_mask_weekly", nameTr: "Haftalık kil maskesi", noteTr: "Parlama ve gözenek görünümü için", slot: "weekly", budget: "medium", minutes: 10, skinTypes: ["oily", "combination"] },
  { id: "st_hydrating_serum", nameTr: "Nem serumu", noteTr: "Nemlendiriciden önce, nemli cilde", slot: "evening", budget: "medium", minutes: 1, skinTypes: ["dry", "normal", "combination", "sensitive"] },
  { id: "st_eye_area", nameTr: "Göz çevresi nemlendirici", noteTr: "Yorgun görünüm için hafif, kokusuz", slot: "evening", budget: "medium", minutes: 1, skinTypes: [] },
  { id: "st_lip_balm", nameTr: "Dudak nemlendirici", noteTr: "SPF'li olanı tercih et", slot: "morning", budget: "low", minutes: 1, skinTypes: [] },
  { id: "st_beard_oil", nameTr: "Sakal yağı", noteTr: "Kaşıntı ve kuruluk için", slot: "evening", budget: "low", minutes: 1, skinTypes: [] },
  { id: "st_hair_conditioner", nameTr: "Saç kremi", noteTr: "Uçlara; haftada 2–3", slot: "weekly", budget: "low", minutes: 3, skinTypes: [] },
  { id: "st_scalp_scrub_weekly", nameTr: "Haftalık saç derisi temizliği", noteTr: "Kepek ve yağ birikimi için", slot: "weekly", budget: "medium", minutes: 5, skinTypes: [] },
];

export const SKIN_STEP_IDS = SKIN_STEPS.map((s) => s.id);
