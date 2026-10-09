// SPEC 9.3: su, uyku, güneş koruması, yürüyüş, protein, kuvvet antrenmanı, tuz/alkol.
export type Habit = { id: string; nameTr: string; defaultTargetTr: string; slot: "daily" | "weekly"; weightRelated: boolean };

export const HABITS: Habit[] = [
  { id: "hb_water", nameTr: "Su", defaultTargetTr: "Günde 2–2,5 litre", slot: "daily", weightRelated: false },
  { id: "hb_sleep", nameTr: "Uyku", defaultTargetTr: "7–8 saat, düzenli saatlerde", slot: "daily", weightRelated: false },
  { id: "hb_sun", nameTr: "Güneş koruması", defaultTargetTr: "Her sabah SPF", slot: "daily", weightRelated: false },
  { id: "hb_walk", nameTr: "Yürüyüş", defaultTargetTr: "Günde 30 dk", slot: "daily", weightRelated: true },
  { id: "hb_protein", nameTr: "Yeterli protein", defaultTargetTr: "Her öğünde bir protein kaynağı", slot: "daily", weightRelated: true },
  { id: "hb_strength", nameTr: "Kuvvet antrenmanı", defaultTargetTr: "Haftada 2–3 seans", slot: "weekly", weightRelated: true },
  { id: "hb_salt_alcohol", nameTr: "Tuz ve alkolü azalt", defaultTargetTr: "Akşam tuzu ve alkolü azalt (yüz şişliği)", slot: "daily", weightRelated: false },
];

export const HABIT_IDS = HABITS.map((h) => h.id);
