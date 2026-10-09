import { getTranslations } from "next-intl/server";
import { Faq } from "@/components/marketing/Faq";
import { PricingCards } from "@/components/marketing/PricingCards";
import { SampleResultCard } from "@/components/marketing/SampleResultCard";
import { StartAnalysisButton } from "@/components/marketing/StartAnalysisButton";

const STEPS = ["s1", "s2", "s3"] as const;

export default async function LandingPage() {
  const t = await getTranslations();
  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <section className="grid gap-8 py-10 md:grid-cols-2 md:items-center md:py-16">
        <div className="space-y-5">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">{t("landing.heroTitle")}</h1>
          <p className="text-base text-muted-foreground sm:text-lg">{t("landing.heroSubtitle")}</p>
          <div className="space-y-2">
            <StartAnalysisButton size="lg" className="w-full sm:w-auto" />
            <p className="text-xs text-muted-foreground">{t("landing.heroNote")}</p>
          </div>
        </div>
        <SampleResultCard />
      </section>

      <section className="py-10" aria-labelledby="how">
        <h2 id="how" className="text-2xl font-semibold tracking-tight">
          {t("landing.howTitle")}
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s} className="rounded-xl border p-4">
              <span className="flex size-8 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">{i + 1}</span>
              <h3 className="mt-3 font-medium">{t(`landing.steps.${s}.title`)}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t(`landing.steps.${s}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="py-10" aria-labelledby="pricing">
        <h2 id="pricing" className="text-2xl font-semibold tracking-tight">
          {t("landing.pricingTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("landing.pricingSubtitle")}</p>
        <div className="mt-5">
          <PricingCards />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("pricing.freeNote")}</p>
      </section>

      <section className="py-10" aria-labelledby="faq">
        <h2 id="faq" className="text-2xl font-semibold tracking-tight">
          {t("landing.faqTitle")}
        </h2>
        <div className="mt-5">
          <Faq />
        </div>
      </section>

      <section className="py-12 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">{t("landing.ctaFinalTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("landing.ctaFinalBody")}</p>
        <div className="mt-5">
          <StartAnalysisButton size="lg" />
        </div>
      </section>
    </div>
  );
}
