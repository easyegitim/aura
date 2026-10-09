import { getTranslations } from "next-intl/server";
import { PricingCards } from "@/components/marketing/PricingCards";

/** /premium: plan seçimi. Hesap bağlama, fatura formu, onaylar ve iyzico Faz 8'de (F14). */
export default async function PremiumPage() {
  const t = await getTranslations("paywall");
  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("pageBody")}</p>
      <PricingCards />
      <p className="text-xs text-muted-foreground">{t("phaseNote")}</p>
    </div>
  );
}
