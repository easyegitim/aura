import type { Preset } from "./types";

// SPEC 10.2: 6 saç rengi. Yalnız saç rengi değişir; yüz ovali korunur.
export const COLOR_PRESETS: Preset[] = [
  { id: "darker_natural", kind: "color", nameTr: "Doğal koyu", suits: ["oval", "round", "square", "heart", "long", "diamond"], prompt: "hair color one to two shades darker than the natural tone, natural finish", protect: "below_brows", noteTr: "Risksiz, kontrastı artırır" },
  { id: "lighter_brown", kind: "color", nameTr: "Açık kahve", suits: ["oval", "round", "square", "heart", "long", "diamond"], prompt: "warm light brown hair color, natural-looking", protect: "below_brows" },
  { id: "ash_blonde", kind: "color", nameTr: "Küllü sarı", suits: ["oval", "round", "square", "heart", "long", "diamond"], prompt: "cool ash blonde hair color with low warmth", protect: "below_brows", noteTr: "Bakım ister" },
  { id: "jet_black", kind: "color", nameTr: "Simsiyah", suits: ["oval", "round", "square", "heart", "long", "diamond"], prompt: "jet black hair color with a soft natural sheen", protect: "below_brows" },
  { id: "auburn", kind: "color", nameTr: "Kızıl kahve", suits: ["oval", "round", "square", "heart", "long", "diamond"], prompt: "rich auburn hair color, red-brown, natural", protect: "below_brows" },
  { id: "silver_gray", kind: "color", nameTr: "Gümüş gri", suits: ["oval", "round", "square", "heart", "long", "diamond"], prompt: "silver gray hair color, even tone", protect: "below_brows", noteTr: "Cesur; bakım ister" },
];
