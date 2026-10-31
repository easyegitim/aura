// Ton koruması (UI spec §8.1, engine spec §7.4): yeni/değişen arayüz metinlerinde aşağılayıcı dil, looksmaxxing argosu,
// sıralama/ortalama dili, yayımlanmayan yöntem iddiaları ve saç göstermeyi isteyen ifade yok.
import { describe, expect, it } from "vitest";
import tr from "@/messages/tr.json";
import { normalizeTr } from "@/lib/ai/safety";
import { CAPTURE_HINTS, LEVER_KEYS, MOD_EXPLAIN_KEYS, NOT_ASSESSED_REASONS, STRUCTURAL_EXPLAIN_KEYS } from "@/lib/score/contract";

type Tree = { [k: string]: string | Tree };
function isTree(v: unknown): v is Tree {
  return typeof v === "object" && v !== null && Object.values(v).every((x) => typeof x === "string" || isTree(x));
}
const loaded: unknown = tr;
if (!isTree(loaded)) throw new Error("tr.json yalnız iç içe metinlerden oluşmalı");
const root: Tree = loaded;

function at(path: string): string | Tree {
  let cur: string | Tree = root;
  for (const p of path.split(".")) {
    if (typeof cur === "string" || !(p in cur)) throw new Error(`tr.json'da yok: ${path}`);
    cur = cur[p]!;
  }
  return cur;
}

function leaves(path: string): [string, string][] {
  const node = at(path);
  if (typeof node === "string") return [[path, node]];
  return Object.keys(node).flatMap((k) => leaves(`${path}.${k}`));
}

/** UI spec §8.1 ve engine spec §7.4 bloklarındaki yeni veya değişen anahtarlar. */
const WALKED = [
  "analysis.pageTitle",
  "analysis.lockedAriaFor",
  "analysis.seePlan",
  "analysis.legacyNote",
  "analysis.processingRefresh",
  "analysis.disclaimerHybrid",
  "analysis.hero",
  "analysis.reference",
  "analysis.subsLegend",
  "analysis.subWhat",
  "analysis.notAssessed",
  "analysis.improveFirst",
  "analysis.levers",
  "analysis.captureHints",
  "analysis.overlay",
  "analysis.explain",
  "analysis.reveal",
  "analysis.progress.v2",
  "analysis.errors.CAPTURE_QUALITY",
  "analysis.errors.AI_SAFETY_BLOCKED",
  "analysis.obs",
  "geometry.noteV2",
  "geometry.tilt",
  "paywall.context",
  "paywall.includes.i5",
  "paywall.includes.i6",
  "paywall.notAssessedNote",
  "paywall.anchor",
  "paywall.seePlans",
  "paywall.plansTitle",
  "paywall.backAria",
  "paywall.continueWith",
  "paywall.backToAnalysis",
  "paywall.methodLink",
  "pricing.vsWeekly",
  "account.export.kvkkNote",
  "camera.trust",
  "camera.warnings",
  "camera.live.manual",
  "camera.live.manualHint",
  "camera.review.relaxedNote",
  "camera.captured.fromGallery",
  "camera.captured.qualityAria",
  "camera.captured.quality",
  "report.basis",
  "method",
];
const walked = WALKED.flatMap(leaves);

// "kötüye kullanım" (hukuki terim, method.data.photo) yargı değildir; yalnız bu kalıp muaf.
const BANNED = /cirkin|kotu(?!ye kullanim)|kusur|zayif|problem|sorun|\bpsl\b|\bmog|chad|incel|yuzdelik dilim|ortalama/;
const UNPUBLISHED_METHOD_CLAIM = /diger alanlardan hesapla|notr deger|uc degerlere gitmez|temkinli degerlendirilir/;
const ASKS_TO_SHOW_HAIR = /sacinin ust kismi|basini ac|sacini goster/;

const keysOf = (path: string, omit?: string) => Object.keys(at(path) as Tree).filter((k) => k !== omit).sort();

describe("tr.json ton koruması (yeni ve değişen metinler)", () => {
  it("yürünen anahtarlar boş değil ve hepsi metin", () => {
    expect(walked.length).toBeGreaterThan(150);
    for (const [path, v] of walked) expect(typeof v, path).toBe("string");
  });

  it("aşağılayıcı dil, argo, sıralama/ortalama dili yok", () => {
    for (const [path, v] of walked) expect(normalizeTr(v), path).not.toMatch(BANNED);
  });

  it("gözlem cümlelerinde rakam ve hastalık adı yok; uzman notu kalıba uyar", () => {
    for (const [path, v] of leaves("analysis.obs")) {
      expect(v, path).not.toMatch(/\d/);
      expect(normalizeTr(v), path).not.toMatch(/rosacea|rozasea|egzama|dermatit|akne vulgaris|sedef|mantar/);
    }
    expect(at("analysis.obs.skinConcernNote")).toMatch(/dermatoloğa göstermek faydalı olabilir\.$/);
  });

  it("anahtar kümeleri sözleşmeyle birebir", () => {
    expect(keysOf("analysis.levers")).toEqual([...LEVER_KEYS].sort());
    expect(keysOf("analysis.explain.items")).toEqual([...STRUCTURAL_EXPLAIN_KEYS, ...MOD_EXPLAIN_KEYS].sort());
    expect(keysOf("analysis.captureHints", "title")).toEqual([...CAPTURE_HINTS].sort());
    expect(keysOf("analysis.notAssessed", "value")).toEqual([...NOT_ASSESSED_REASONS].sort());
  });

  it("yöntem iddiaları: cilt tanımında kızarıklık/leke yok; yayımlanmayan kurallar hiçbir yerde yok", () => {
    expect(normalizeTr(String(at("analysis.subWhat.skin")))).not.toMatch(/kizariklik|leke/);
    for (const top of ["analysis", "method", "camera"]) {
      for (const [path, v] of leaves(top)) expect(normalizeTr(v), path).not.toMatch(UNPUBLISHED_METHOD_CLAIM);
    }
    for (const [path, v] of leaves("method")) {
      expect(v, path).not.toContain("5,5");
      expect(normalizeTr(v), path).not.toContain("referans degeri");
    }
  });

  it("hiçbir metin saçı göstermeyi, başı açmayı istemez", () => {
    for (const [path, v] of [...walked, ...leaves("camera.warnings")]) expect(normalizeTr(v), path).not.toMatch(ASKS_TO_SHOW_HAIR);
  });

  it("e2e metinleri korunur (UI spec §8.4)", () => {
    expect(String(at("analysis.seePlan"))).toMatch(/planı gör/i);
    expect(at("camera.review.use")).toBe("Bu fotoğrafı kullan");
    expect(at("camera.review.retake")).toBe("Yeniden çek");
    expect(at("camera.live.cancel")).toBe("Vazgeç");
    expect(at("analysis.start")).toBe("Analizi başlat");
    expect(at("analysis.unlock")).toBe("Kilidi aç");
    expect(at("geometry.faceShape")).toMatch(/yüz şekli/i);
    expect(at("paywall.seePlans")).toBe("Planları gör");
    expect(String(at("paywall.continueWith"))).toMatch(/^Devam et/);
    expect(JSON.stringify(tr)).not.toContain("₺8.750");
  });
});
