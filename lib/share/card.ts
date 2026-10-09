"use client";

// SPEC F10 / Faz 7 madde 6: paylaşım kartı istemcide canvas ile üretilir; sunucuya hiçbir şey gitmez.
export type ShareCardFormat = "story" | "square";

export type ShareCardInput = {
  overall: number;
  potential: number;
  subs: { label: string; value: number }[]; // en çok 3
  appName: string;
  url: string;
  photo?: ImageBitmap | null;
  format: ShareCardFormat;
  /** Sabit not (SPEC 4.3). */
  disclaimer: string;
};

export const CARD_SIZES: Record<ShareCardFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
};

const fmt = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export async function renderShareCard(input: ShareCardInput): Promise<Blob> {
  const { w, h } = CARD_SIZES[input.format];
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  // Arka plan: nötr koyu degrade (skorlar nötr renk skalasıyla gösterilir, SPEC 4.3)
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#111111");
  g.addColorStop(1, "#2a2a2a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const pad = 80;
  let y = input.format === "story" ? 260 : 110;
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";

  // Başlık
  ctx.font = "600 44px system-ui, -apple-system, sans-serif";
  ctx.fillText(input.appName, pad, y);
  y += 90;

  // İsteğe bağlı fotoğraf (daire)
  if (input.photo) {
    const r = input.format === "story" ? 180 : 130;
    const cx = w - pad - r;
    const cy = y + r;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    const s = Math.min(input.photo.width, input.photo.height);
    ctx.drawImage(input.photo, (input.photo.width - s) / 2, (input.photo.height - s) / 2, s, s, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  // Genel skor
  ctx.font = "400 40px system-ui, sans-serif";
  ctx.fillStyle = "#bdbdbd";
  ctx.fillText("Genel skor", pad, y);
  y += 56;
  ctx.font = "700 220px system-ui, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(fmt(input.overall), pad, y);
  y += 250;

  // Potansiyel
  ctx.font = "500 48px system-ui, sans-serif";
  ctx.fillStyle = "#e6e6e6";
  ctx.fillText(`Potansiyel ${fmt(input.potential)}  (+${fmt(Math.max(0, input.potential - input.overall))})`, pad, y);
  y += 110;

  // 3 alt skor çubuğu
  const barW = w - pad * 2;
  for (const s of input.subs.slice(0, 3)) {
    ctx.font = "400 36px system-ui, sans-serif";
    ctx.fillStyle = "#bdbdbd";
    ctx.fillText(s.label, pad, y);
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(fmt(s.value), w - pad, y);
    ctx.textAlign = "left";
    y += 50;
    ctx.fillStyle = "#3a3a3a";
    roundRect(ctx, pad, y, barW, 16, 8);
    ctx.fillStyle = "#f2f2f2";
    roundRect(ctx, pad, y, (barW * Math.min(10, s.value)) / 10, 16, 8);
    y += 60;
  }

  // Alt bilgi
  const footY = h - (input.format === "story" ? 220 : 150);
  ctx.font = "400 30px system-ui, sans-serif";
  ctx.fillStyle = "#9a9a9a";
  wrapText(ctx, input.disclaimer, pad, footY, w - pad * 2, 38);
  ctx.font = "500 34px system-ui, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(input.url, pad, h - 90);

  return canvas.convertToBlob({ type: "image/png" });
}

function roundRect(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(w, r * 2), h, r);
  ctx.fill();
}

function wrapText(ctx: OffscreenCanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
}

/** Web Share API (dosya destekliyorsa), yoksa indirme. */
export async function shareOrDownload(blob: Blob, filename: string, title: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: blob.type });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch {
      // kullanıcı vazgeçti → indirmeye düş
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return "downloaded";
}
