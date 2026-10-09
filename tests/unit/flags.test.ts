import { describe, expect, it } from "vitest";
import { isFeatureEnabled } from "@/lib/config/flags";

describe("isFeatureEnabled", () => {
  it("tanımsız veya false → kapalı (Uzman Ağı varsayılan kapalı, SPEC 12.2)", () => {
    expect(isFeatureEnabled("expertNetwork", {})).toBe(false);
    expect(isFeatureEnabled("expertNetwork", { FEATURE_EXPERT_NETWORK: "false" })).toBe(false);
    expect(isFeatureEnabled("weekPass", { FEATURE_WEEK_PASS: "1" })).toBe(false);
  });
  it("yalnız 'true' açar (büyük/küçük harf ve boşluk toleranslı)", () => {
    expect(isFeatureEnabled("expertNetwork", { FEATURE_EXPERT_NETWORK: "true" })).toBe(true);
    expect(isFeatureEnabled("weekPass", { FEATURE_WEEK_PASS: " TRUE " })).toBe(true);
  });
});
