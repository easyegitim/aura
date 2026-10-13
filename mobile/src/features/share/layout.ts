// Paylaşım kartı düzeni (SPEC F10): skor + potansiyel + 3 alt skor, sabit not; fotoğraf isteğe bağlı. Saf; birim testli.
export type ShareCardFormat = "story" | "square";
export const CARD_SIZES: Record<ShareCardFormat, { w: number; h: number }> = { story: { w: 1080, h: 1920 }, square: { w: 1080, h: 1080 } };

export type ShareCardInput = { overall: number; potential: number; subs: { label: string; value: number }[]; appName: string; url: string; disclaimer: string; format: ShareCardFormat; hasPhoto: boolean };

export type TextItem = { text: string; x: number; y: number; size: number; weight: "regular" | "bold"; align: "left" | "center"; color: string };
export type BarItem = { x: number; y: number; w: number; h: number; ratio: number; label: string };
export type Layout = { w: number; h: number; photo: { x: number; y: number; w: number; h: number } | null; texts: TextItem[]; bars: BarItem[] };

export const fmt1 = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function shareCardLayout(input: ShareCardInput): Layout {
  const { w, h } = CARD_SIZES[input.format];
  const cx = w / 2;
  const photoH = input.hasPhoto ? Math.round(h * (input.format === "story" ? 0.42 : 0.38)) : 0;
  const photo = input.hasPhoto ? { x: Math.round(w * 0.15), y: 120, w: Math.round(w * 0.7), h: photoH } : null;
  let y = input.hasPhoto ? 120 + photoH + 90 : Math.round(h * 0.2);
  const texts: TextItem[] = [{ text: input.appName, x: cx, y: 80, size: 40, weight: "bold", align: "center", color: "#a3a3a3" }];
  texts.push({ text: fmt1(input.overall), x: cx, y, size: 200, weight: "bold", align: "center", color: "#ffffff" });
  y += 70;
  texts.push({ text: `Potansiyel ${fmt1(input.potential)}`, x: cx, y, size: 56, weight: "regular", align: "center", color: "#d4d4d4" });
  y += 110;
  const bars: BarItem[] = [];
  const barW = Math.round(w * 0.7);
  for (const s of input.subs.slice(0, 3)) {
    texts.push({ text: `${s.label}  ${fmt1(s.value)}`, x: cx - barW / 2, y, size: 36, weight: "regular", align: "left", color: "#e5e5e5" });
    bars.push({ x: cx - barW / 2, y: y + 18, w: barW, h: 16, ratio: Math.max(0, Math.min(1, s.value / 10)), label: s.label });
    y += 90;
  }
  texts.push({ text: input.url, x: cx, y: h - 140, size: 34, weight: "regular", align: "center", color: "#a3a3a3" });
  texts.push({ text: input.disclaimer, x: cx, y: h - 80, size: 26, weight: "regular", align: "center", color: "#737373" });
  return { w, h, photo, texts, bars };
}
