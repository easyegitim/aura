import type { Preset } from "./types";

// SPEC 10.2: 12 sakal stili. protect: above_lip (kaş üstünden burun altına kadar korunur; alt yüz modele bırakılır).
export const BEARD_PRESETS: Preset[] = [
  { id: "clean_shaven", kind: "beard", nameTr: "Sakalsız", suits: ["oval", "heart", "diamond", "long", "round", "square"], presentation: ["male"], prompt: "completely clean-shaven face, smooth skin", protect: "above_lip", noteTr: "Çene hattını olduğu gibi gösterir" },
  { id: "stubble_light", kind: "beard", nameTr: "Hafif kirli sakal", suits: ["oval", "round", "square", "heart", "long", "diamond"], presentation: ["male"], prompt: "light 2-3 day stubble, evenly trimmed, defined neckline", protect: "above_lip", noteTr: "Her yüze uyar, az bakım" },
  { id: "stubble_heavy", kind: "beard", nameTr: "Belirgin kirli sakal", suits: ["round", "oval", "square", "heart"], presentation: ["male"], prompt: "heavy 5-7 day stubble with sharp cheek and neck lines", protect: "above_lip", noteTr: "Çene hattını belirginleştirir" },
  { id: "short_boxed", kind: "beard", nameTr: "Kısa kutu sakal", suits: ["round", "oval", "square", "diamond"], presentation: ["male"], prompt: "short boxed beard, 1cm, sharp edges, trimmed mustache", protect: "above_lip", noteTr: "Yuvarlak yüzü keskinleştirir" },
  { id: "full_medium", kind: "beard", nameTr: "Orta dolgun sakal", suits: ["oval", "heart", "diamond", "long"], presentation: ["male"], prompt: "full medium-length beard, 3cm, rounded under the chin", protect: "above_lip", noteTr: "Dar çeneyi doldurur" },
  { id: "full_long", kind: "beard", nameTr: "Uzun dolgun sakal", suits: ["oval", "heart", "diamond"], presentation: ["male"], prompt: "full long beard, well-groomed, tapered toward the chin", protect: "above_lip", noteTr: "Uzun yüzde kaçın" },
  { id: "goatee", kind: "beard", nameTr: "Keçi sakalı", suits: ["round", "square", "oval"], presentation: ["male"], prompt: "goatee covering chin and mustache, cheeks clean-shaven", protect: "above_lip", noteTr: "Çeneyi uzatır" },
  { id: "van_dyke", kind: "beard", nameTr: "Van Dyke", suits: ["round", "square", "oval"], presentation: ["male"], prompt: "Van Dyke: pointed chin beard with a separate mustache, cheeks shaved", protect: "above_lip" },
  { id: "chin_strap", kind: "beard", nameTr: "Çene şeridi", suits: ["round", "oval", "heart"], presentation: ["male"], prompt: "thin chin strap beard along the jawline, no mustache", protect: "above_lip", noteTr: "Çene hattını çizer" },
  { id: "anchor", kind: "beard", nameTr: "Çapa sakal", suits: ["round", "square", "oval"], presentation: ["male"], prompt: "anchor beard: chin beard tracing the jaw with a pointed end and mustache", protect: "above_lip" },
  { id: "mustache_classic", kind: "beard", nameTr: "Klasik bıyık", suits: ["oval", "square", "long", "diamond"], presentation: ["male"], prompt: "classic groomed mustache, clean-shaven cheeks and chin", protect: "above_lip" },
  { id: "faded_beard", kind: "beard", nameTr: "Fade'li sakal", suits: ["round", "square", "oval", "heart"], presentation: ["male"], prompt: "beard with a fade blending from sideburns into a fuller chin", protect: "above_lip", noteTr: "Yanakları inceltir" },
];
