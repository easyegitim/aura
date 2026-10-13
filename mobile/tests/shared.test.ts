/** M0 çıkış kriteri: paylaşılan saf modüller mobil derleme zinciriyle (babel alias "@/") çalışır. */
import { PLANS } from "@/lib/config/plans";
import { calibrate } from "@/lib/score/calibration";
import { getOnboardingRedirect } from "@/lib/onboarding/gate";
import { REQUIRED_ANALYSIS_CONSENTS } from "@/lib/consent";

describe("paylaşılan modüller (SPEC-MOBILE M1)", () => {
  it("planlar ve kalibrasyon kökten gelir", () => {
    expect(Object.keys(PLANS)).toContain("monthly");
    expect(calibrate(6.5, "v0")).toBe(5.5);
  });
  it("onboarding kapısı ve rızalar aynı kurallardır", () => {
    expect(getOnboardingRedirect(null)).toBe("/baslangic/yas");
    expect(REQUIRED_ANALYSIS_CONSENTS).toHaveLength(3);
  });
});
