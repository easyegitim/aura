import { expect, test } from "@playwright/test";

test.describe("Yasal sayfalar ve çerez banner'ı (F16)", () => {
  test("her yasal metin sürüm ve tarihle açılır", async ({ page }) => {
    for (const slug of ["aydinlatma", "acik-riza", "gizlilik", "cerez", "kullanim-kosullari", "mesafeli-satis", "on-bilgilendirme", "iptal-iade"]) {
      const res = await page.goto(`/yasal/${slug}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText(/Sürüm \d{4}-\d{2}-\d{2}\.\d+/)).toBeVisible();
    }
  });

  test("bilinmeyen slug 404", async ({ page }) => {
    const res = await page.goto("/yasal/yok-boyle-bir-sey");
    expect(res?.status()).toBe(404);
  });

  test("çerez banner'ı tercihi çerezde saklar ve bir daha görünmez", async ({ page, context }) => {
    await page.goto("/");
    const banner = page.getByRole("dialog", { name: "Çerez tercihi" });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Reddet" }).click();
    await expect(banner).toBeHidden();
    const cookie = (await context.cookies()).find((c) => c.name === "aura_cookies");
    expect(cookie?.value).toBe("denied");
    await page.reload();
    await expect(page.getByRole("dialog", { name: "Çerez tercihi" })).toHaveCount(0);
  });

  test("onboarding ekranları oturumsuz açılışa döner (F03)", async ({ page }) => {
    for (const path of ["/baslangic/yas", "/baslangic/izinler", "/baslangic/anket", "/tara"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/$/);
    }
  });

  test("API uçları oturumsuz 401 döner (withGuard)", async ({ request }) => {
    for (const path of ["/api/onboarding/age", "/api/consents", "/api/onboarding/questionnaire"]) {
      const res = await request.post(path, { data: {} });
      expect(res.status(), path).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("UNAUTHENTICATED");
    }
  });
});

test("debug sayfası production'da 404 (SPEC 4.2)", async ({ page }) => {
  const res = await page.goto("/debug/landmarks");
  expect(res?.status()).toBe(404);
});
