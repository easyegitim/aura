import { describe, expect, it } from "vitest";
import { isPremium } from "@/lib/billing/entitlement";
import { isAuthorizedWebhook, mapSubscriber, planFromProductId, webhookAppUserId, webhookEventKey } from "@/lib/billing/revenuecat";

const now = new Date("2026-10-13T12:00:00Z");

describe("RevenueCat eşlemesi (SPEC 15.4 / SPEC-MOBILE M6)", () => {
  it("ürün kimliğinden plan", () => {
    expect(planFromProductId("aura_weekly")).toBe("weekly");
    expect(planFromProductId("com.easyegitim.aura.monthly")).toBe("monthly");
    expect(planFromProductId("aura_yearly")).toBe("yearly");
    expect(planFromProductId("aura_week_pass")).toBe("week_pass");
    expect(planFromProductId("bilinmeyen")).toBeNull();
  });
  it("aktif yetki → active; iptal algılanmış → cancel_at_period_end; premium açık", () => {
    const m = mapSubscriber(
      {
        entitlements: { premium: { expires_date: "2026-11-13T12:00:00Z", product_identifier: "aura_monthly", purchase_date: "2026-10-13T11:00:00Z" } },
        subscriptions: { aura_monthly: { expires_date: "2026-11-13T12:00:00Z", purchase_date: "2026-10-13T11:00:00Z", unsubscribe_detected_at: "2026-10-14T00:00:00Z" } },
      },
      now,
    );
    expect(m?.row).toMatchObject({ plan: "monthly", status: "active", cancel_at_period_end: true });
    expect(isPremium({ status: m!.row.status, current_period_end: m!.row.current_period_end })).toBe(true);
  });
  it("süresi geçmiş: fatura sorunu varsa past_due, yoksa expired; yetki yoksa null", () => {
    const base = { entitlements: { premium: { expires_date: "2026-10-01T00:00:00Z", product_identifier: "aura_weekly", purchase_date: "2026-09-24T00:00:00Z" } } };
    expect(mapSubscriber({ ...base, subscriptions: { aura_weekly: { expires_date: "2026-10-01T00:00:00Z", purchase_date: "2026-09-24T00:00:00Z", billing_issues_detected_at: "2026-10-01T00:00:00Z" } } }, now)?.row.status).toBe("past_due");
    expect(mapSubscriber(base, now)?.row.status).toBe("expired");
    expect(mapSubscriber({ entitlements: {} }, now)).toBeNull();
  });
  it("webhook yetkisi sabit uzunluk karşılaştırması; app_user_id ve event_key", () => {
    expect(isAuthorizedWebhook("secret-123", "secret-123")).toBe(true);
    expect(isAuthorizedWebhook("Bearer secret-123", "secret-123")).toBe(true);
    expect(isAuthorizedWebhook("secret-124", "secret-123")).toBe(false);
    expect(isAuthorizedWebhook("x", undefined)).toBe(false);
    expect(webhookAppUserId({ event: { app_user_id: "u1" } })).toBe("u1");
    expect(webhookAppUserId({ event: { original_app_user_id: "u0" } })).toBe("u0");
    expect(webhookAppUserId({})).toBeNull();
    expect(webhookEventKey({ event: { id: "evt_1" } })).toBe("revenuecat:evt_1");
  });
});
