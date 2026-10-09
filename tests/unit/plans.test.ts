import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN_ID, ENTITLEMENTS, PLANS, SUBSCRIPTION_PLAN_IDS, formatTry, weeklyEquivalentTry } from "@/lib/config/plans";

describe("PLANS (SPEC 5.1, KARAR)", () => {
  it("x = 250; aylık 3x, yıllık 35x", () => {
    expect(PLANS.weekly.priceTry).toBe(250);
    expect(PLANS.monthly.priceTry).toBe(250 * 3);
    expect(PLANS.yearly.priceTry).toBe(250 * 35);
    expect(PLANS.week_pass.priceTry).toBe(250);
    expect(PLANS.week_pass.oneTimeDays).toBe(7);
  });

  it("iyzico periyotları ve env referansları", () => {
    expect(PLANS.weekly.iyzicoInterval).toBe("WEEKLY");
    expect(PLANS.monthly.iyzicoInterval).toBe("MONTHLY");
    expect(PLANS.yearly.iyzicoInterval).toBe("YEARLY");
    expect(PLANS.week_pass.featureFlag).toBe("FEATURE_WEEK_PASS");
  });

  it("haftalık eşdeğerler SPEC tablosuyla uyumlu (250 / ~173 / ~168)", () => {
    expect(weeklyEquivalentTry("weekly")).toBe(250);
    expect(weeklyEquivalentTry("monthly")).toBe(173);
    expect(weeklyEquivalentTry("yearly")).toBe(168);
  });

  it("yıllık plan önceden seçili, üç abonelik planı sıralı", () => {
    expect(DEFAULT_PLAN_ID).toBe("yearly");
    expect(SUBSCRIPTION_PLAN_IDS).toEqual(["weekly", "monthly", "yearly"]);
  });

  it("TL biçimlendirme Türkçe binlik ayracı kullanır", () => {
    expect(formatTry(8750)).toMatch(/8\.750/);
    expect(formatTry(250)).toMatch(/250/);
  });
});

describe("ENTITLEMENTS (SPEC 5.2)", () => {
  it("ücretsiz: toplam 1 analiz, deneme yok", () => {
    expect(ENTITLEMENTS.free).toEqual({ analysesLifetime: 1, tryonsPerWindow: 0, reportRegens: 0 });
  });
  it("premium: 7 günlük pencerede 1 analiz, 10 deneme, 2 yeniden üretim", () => {
    expect(ENTITLEMENTS.premium).toEqual({ analysesPerWindow: 1, tryonsPerWindow: 10, reportRegens: 2, windowDays: 7 });
  });
});
