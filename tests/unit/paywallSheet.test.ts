import { describe, expect, it } from "vitest";
import tr from "@/messages/tr.json";
import { paywallContext } from "@/components/paywall/PaywallSheet";
import { PAYWALL_TRIGGERS } from "@/lib/config/paywall";
import { SUB_KEYS } from "@/lib/config/teaser";

const PRICE = /₺|TL/;

describe("paywallContext (UI spec §4.1)", () => {
  it("her tetikleyici bir bağlam satırına eşlenir", () => {
    expect(paywallContext("score_main")).toEqual({ key: "score" });
    expect(paywallContext("score_potential")).toEqual({ key: "potential" });
    expect(paywallContext("improve_first")).toEqual({ key: "improve" });
    expect(paywallContext("measurements")).toEqual({ key: "measurements" });
    expect(paywallContext("plan")).toEqual({ key: "plan" });
    expect(paywallContext("plan_page")).toEqual({ key: "plan" });
    for (const k of SUB_KEYS) expect(paywallContext(`sub_${k}`)).toEqual({ key: "sub", sub: k });
    for (const tr0 of PAYWALL_TRIGGERS) expect(tr.paywall.context[paywallContext(tr0).key]).toBeTruthy();
  });
});

describe("sayfa 1 tek fiyat satırı (flow.spec: dialog içinde tek ₺|TL öğesi)", () => {
  it("anchor dışındaki sayfa 1 metinlerinde fiyat yok", () => {
    const p = tr.paywall;
    const page1 = [p.title, p.body, p.notAssessedNote, p.methodLink, p.seePlans, p.note, ...Object.values(p.includes), ...Object.values(p.context), ...Object.values(tr.analysis.sub)];
    for (const s of page1) expect(s).not.toMatch(PRICE);
    expect(p.anchor).toContain("{yearly}");
  });
});
