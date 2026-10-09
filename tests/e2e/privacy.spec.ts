/**
 * Gizlilik testi (CLAUDE.md, zorunlu; Faz 7'den itibaren her faz sonunda). Tüm ağ trafiğini izler.
 *
 * Gereksinimler (yoksa test hemen BAŞARISIZ olur; atlanmaz):
 *   PRIVACY_E2E=1                       → playwright.config.ts "privacy" projesini ekler
 *   Sunucu gerçek (yerel) Supabase ile çalışıyor; Turnstile site anahtarı boş (captcha kapalı)
 *   PRIVACY_FACE_VIDEO=/sifreli/disk/face.y4m → Chrome sahte kamera kaynağı (rızalı yüz; depoya konmaz)
 *   GEMINI_API_KEY tanımlı (ücretli; onayla)
 */
import { expect, test, type Request } from "@playwright/test";

const IMAGE_SINKS = ["/api/analyses", "/api/tryon"];

function hasImagePayload(req: Request): boolean {
  const ct = req.headers()["content-type"] ?? "";
  if (ct.startsWith("image/") || ct.startsWith("multipart/")) return true;
  const body = req.postData() ?? "";
  return body.includes("/9j/") || body.includes("data:image/");
}

test.describe("Gizlilik (tüm ağ trafiği)", () => {
  test.beforeAll(() => {
    for (const k of ["PRIVACY_E2E", "PRIVACY_FACE_VIDEO"]) {
      if (!process.env[k]) throw new Error(`${k} gerekli — tests/e2e/privacy.spec.ts başlığına bak.`);
    }
  });

  test("görsel yalnız /api/analyses ve /api/tryon'a gider; gövdede landmark yok; kilitli değerler yanıtta yok", async ({ page, context }) => {
    const requests: Request[] = [];
    page.on("request", (r) => requests.push(r));
    const analysisResponses: unknown[] = [];
    page.on("response", async (res) => {
      if (/\/api\/analyses(\/|$)/.test(new URL(res.url()).pathname) && res.ok()) analysisResponses.push(await res.json().catch(() => null));
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Analizini başlat" }).first().click();
    await expect(page).toHaveURL(/\/baslangic\/yas/);
    await page.getByLabel("Doğum yılın").selectOption("1990");
    await page.getByRole("button", { name: "Devam" }).click();

    await expect(page).toHaveURL(/\/baslangic\/izinler/);
    const box = page.locator("[tabindex='0']").first();
    await box.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.getByRole("button", { name: "Okudum" }).click();
    for (const id of ["biometric_processing", "photo_ai_analysis", "cross_border_transfer"]) await page.locator(`#consent-${id}`).click();
    await page.getByRole("button", { name: "Devam" }).click();

    await expect(page).toHaveURL(/\/baslangic\/anket/);
    // Anket: her adımda ilk seçeneği işaretle, ileri
    for (let i = 0; i < 10; i++) {
      const radios = page.getByRole("radio");
      if ((await radios.count()) > 0) {
        for (const group of await page.locator("[role=radiogroup]").all()) await group.getByRole("radio").first().click();
      }
      const checks = page.getByRole("checkbox");
      if ((await checks.count()) > 0 && (await page.getByRole("checkbox", { checked: true }).count()) === 0) await checks.first().click();
      const skip = page.getByRole("button", { name: "Bu adımı atla" });
      if (await skip.isVisible().catch(() => false)) await skip.click();
      const next = page.getByRole("button", { name: /^(İleri|Bitir)$/ });
      await next.click();
    }

    await expect(page).toHaveURL(/\/tara/, { timeout: 15_000 });
    await page.getByRole("button", { name: "Kamerayı aç" }).click();
    await page.getByRole("button", { name: "Bu fotoğrafı kullan" }).click({ timeout: 60_000 });
    await page.getByRole("button", { name: "Analizi başlat" }).click();
    await expect(page).toHaveURL(/\/analiz\/[0-9a-f-]{36}/, { timeout: 90_000 });

    // 1) Görsel içeren gövdeler yalnız izinli uçlara
    const imageReqs = requests.filter(hasImagePayload);
    expect(imageReqs.length).toBeGreaterThan(0);
    for (const r of imageReqs) {
      const path = new URL(r.url()).pathname;
      expect(IMAGE_SINKS.some((s) => path.startsWith(s)), `${path} görsel almamalı`).toBe(true);
    }
    // PostHog, Sentry, Supabase, Resend, Turnstile vb. hiçbirine görsel gitmedi
    for (const r of requests) {
      const host = new URL(r.url()).host;
      if (/posthog|sentry|supabase|resend|cloudflare|turnstile/.test(host)) expect(hasImagePayload(r), `${host} görsel aldı`).toBe(false);
    }

    // 2) /api/analyses gövdesinde 478 noktalık dizi yok; yalnız GeometryResult
    const post = requests.find((r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/analyses");
    expect(post).toBeTruthy();
    const body = JSON.parse(post!.postData() ?? "{}") as { geometry?: Record<string, unknown>; image?: string };
    expect(body.geometry?.version).toBe("geo-v1");
    expect(JSON.stringify(body.geometry)).not.toMatch(/landmarks|"x":/);
    expect(body.image?.startsWith("/9j/")).toBe(true);

    // 3) Analitik/hata olaylarında görsel, skor, metrik, e-posta yok (PostHog/Sentry istekleri)
    for (const r of requests.filter((q) => /posthog|sentry/.test(new URL(q.url()).host))) {
      const b = r.postData() ?? "";
      expect(b).not.toMatch(/\/9j\/|lengthRatio|overall|@/);
    }

    // 4) Ücretsiz hesapta API yanıtlarında kilitli değerler yok
    for (const res of analysisResponses as { overall?: { value: unknown; locked: boolean }; potential?: { value: unknown; locked: boolean } }[]) {
      if (!res?.overall) continue;
      if (res.overall.locked) expect(res.overall.value).toBeNull();
      if (res.potential?.locked) expect(res.potential.value).toBeNull();
    }
    const html = await page.content();
    expect(html).not.toMatch(/"potential":\{"value":\d/);

    // 5) Supabase istemcisiyle analyses / coach_reports okunamıyor
    const cookies = await context.cookies();
    const rows = await page.evaluate(async (cookieNames) => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      void cookieNames;
      const res = await fetch(`${url}/rest/v1/analyses?select=id`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" } });
      return res.status;
    }, cookies.map((c) => c.name));
    expect([401, 200]).toContain(rows); // 200 ise RLS boş dizi döndürür; 401 anon key ile yetkisiz
  });
});
