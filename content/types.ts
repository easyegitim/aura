import type { FaceShape } from "@/lib/face/types";
import type { Questionnaire } from "@/lib/questionnaire";

export type PresetKind = "hair" | "beard" | "color";
export type Protect = "below_brows" | "above_lip";

/** SPEC 10.2: her preset { id, kind, nameTr, suits, hairTypes?, presentation?, prompt (İngilizce), protect }. */
export type Preset = {
  id: string;
  kind: PresetKind;
  nameTr: string;
  /** Uygun yüz şekilleri; boşsa hepsi. */
  suits: FaceShape[];
  hairTypes?: Questionnaire["hairType"][];
  presentation?: Array<"male" | "female">;
  /** Görsel modele verilen İngilizce açıklama (SPEC 10.6 {preset.prompt}). */
  prompt: string;
  protect: Protect;
  /** Kısa Türkçe not (rapor promptunda id + ad + not). */
  noteTr?: string;
};
