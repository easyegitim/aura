/**
 * SPEC 8.8 / Faz 15 madde 2: adalet (önyargı) kontrolü.
 * Ücretli AI çağrısı yapar; CLAUDE.md gereği yalnız açık onayla çalıştırılır. Fotoğraflar yalnız şifreli yerel diskte
 * durur; bu betik hiçbir görseli yazmaz, yüklemez veya loglamaz. Dosya adları kişi kimliği taşımamalı.
 *
 * Kullanım: GEMINI_API_KEY=... pnpm fairness <manifest.json> [--calls 3] [--out docs/fairness.md]
 * manifest.json: { "dir": "/sifreli/disk/klasor", "items": [ { "file": "a1.jpg", "groups": { "skinTone": "IV", "gender": "f", "beard": "no", "glasses": "no", "headCovering": "yes" } }, ... ] }
 *
 * Ölçüm: her grup boyutu için grup ortalamaları arasındaki en büyük farkın, grup içi (havuzlanmış) standart sapmaya oranı.
 * Yayın kapısı: bir grup sistematik olarak > 0,5 puan düşükse (kalibre skorda) yayın durur (SPEC 8.8); hedef ≤ 0,3 (SPEC 17.2).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { buildScorePrompt } from "../lib/ai/prompts/score.v1";
import { SCORE_OUTPUT_JSON_SCHEMA, ScoreOutput } from "../lib/ai/scoreSchema";
import { SUB_KEYS } from "../lib/config/teaser";
import { aggregateScores } from "../lib/score/aggregate";
import { calibrate } from "../lib/score/calibration";
import { fairnessSummary, type FairnessItem } from "../lib/score/fairness";

const args = process.argv.slice(2);
const manifestPath = args.find((a) => !a.startsWith("--"));
const calls = Number(args[args.indexOf("--calls") + 1]) || 3;
const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : "docs/fairness.md";
if (!manifestPath) {
  console.error("Kullanım: pnpm fairness <manifest.json> [--calls 3] [--out docs/fairness.md]");
  process.exit(1);
}
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY gerekli.");
  process.exit(1);
}
const model = process.env.GEMINI_SCORE_MODEL || "gemini-3.5-flash-lite";
const ai = new GoogleGenAI({ apiKey });

type Manifest = { dir: string; items: { file: string; groups: Record<string, string> }[] };
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;

async function scoreOnce(b64: string, prompt: string) {
  const res = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: "image/jpeg", data: b64 } }, { text: prompt }] }],
    config: { temperature: 0, responseMimeType: "application/json", responseJsonSchema: SCORE_OUTPUT_JSON_SCHEMA },
  });
  return ScoreOutput.parse(JSON.parse(res.text ?? ""));
}

const prompt = buildScorePrompt({ presentation: "unspecified", geometry: { note: "fairness run, no geometry" }, bodyFatContextAllowed: false });
const items: FairnessItem[] = [];
for (const [i, it] of manifest.items.entries()) {
  const b64 = readFileSync(path.join(manifest.dir, it.file)).toString("base64");
  const settled = await Promise.allSettled(Array.from({ length: calls }, () => scoreOnce(b64, prompt)));
  try {
    const agg = aggregateScores(settled);
    items.push({ groups: it.groups, overall: calibrate(agg.rawOverall, "v0"), subscores: Object.fromEntries(SUB_KEYS.map((k) => [k, agg.rawSubscores[k]])) });
    console.log(`${i + 1}/${manifest.items.length} tamam`);
  } catch (e) {
    console.log(`${i + 1}: atlandı (${e instanceof Error ? e.message : "hata"})`);
  }
}

const summary = fairnessSummary(items);
const today = new Date().toISOString().slice(0, 10);
const lines: string[] = [
  "# Adalet (önyargı) raporu",
  "",
  `Tarih: ${today} · Model: ${model} · Çağrı/foto: ${calls} · n=${items.length} · Prompt: score.v1 · Kalibrasyon: v0`,
  "",
  "Ölçüm: grup ortalamaları arasındaki en büyük fark / grup içi havuzlanmış SS (SPEC 8.8). Yayın kapısı: hiçbir grup > 0,5 puan düşük değil; hedef ≤ 0,3 (SPEC 17.2).",
  "",
  "| Boyut | Gruplar (n) | Ortalamalar | En büyük fark | Oran (fark/SS) | Kapı |",
  "| --- | --- | --- | --- | --- | --- |",
];
for (const d of summary.dimensions) {
  lines.push(
    `| ${d.dimension} | ${d.groups.map((g) => `${g.name} (${g.n})`).join(", ")} | ${d.groups.map((g) => g.mean.toFixed(2)).join(" / ")} | ${d.maxGap.toFixed(2)} | ${d.ratio.toFixed(2)} | ${d.pass ? "✅" : "⛔ yayın durur"} |`,
  );
}
lines.push("", `Sonuç: ${summary.pass ? "✅ tüm boyutlar kapının içinde" : "⛔ en az bir boyut kapının dışında; prompt veya kalibrasyon düzeltilmeden yayın yok"}`, "");
lines.push("Fotoğraflar yalnız şifreli yerel diskte; bu rapor görsel veya kişi kimliği içermez.");
writeFileSync(out, `${lines.join("\n")}\n`);
console.log(`\n${out} yazıldı. Sonuç: ${summary.pass ? "GEÇTİ" : "KALDI"}`);
