import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PricingCards } from "@/components/marketing/PricingCards";

const INCLUDES = ["i1", "i2", "i3", "i4", "i5", "i6"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pricing");
  return { title: t("title") };
}

export default async function PricingPage() {
  const t = await getTranslations("pricing");
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      <PricingCards withCta />
      <section className="space-y-3" aria-labelledby="includes">
        <h2 id="includes" className="text-xl font-semibold tracking-tight">
          {t("includesTitle")}
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {INCLUDES.map((k) => (
            <li key={k} className="rounded-lg border p-3 text-sm">
              {t(`includes.${k}`)}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{t("freeNote")}</p>
        <p className="text-xs text-muted-foreground">{t("autoRenewNote")}</p>
      </section>
    </div>
  );
}
