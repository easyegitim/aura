import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { MethodViewTracker } from "@/components/marketing/MethodViewTracker";
import { getPublicEngineInfo } from "@/lib/ai/disclosure.server";
import { FAIRNESS_LAST_RUN, parseMethodFrom } from "@/lib/config/method";
import { CALIBRATION_REFERENCE, SUB_KIND_HYBRID } from "@/lib/config/scoring";
import { SUB_KEYS, type SubKey } from "@/lib/config/teaser";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("method");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/** Yapısal alanlar cihazdaki geometriden, geliştirilebilir alanlar görünür ayrıntı kategorilerinden (UI spec §5.2, C2). */
const SOURCE: Record<SubKey, "device" | "ai"> = { harmony: "device", eyes: "device", jawline: "device", skin: "ai", hair: "ai", grooming: "ai" };
const DATA_KEYS = ["landmarks", "geometry", "photo", "tryon", "progress", "analytics"] as const;
const LIMIT_KEYS = ["l1", "l2", "l3", "l4", "l5", "l6"] as const;

/** "Yüz noktaları: yalnız telefonunda kalır." → terim ve açıklama (dl için). İki nokta yoksa tümü terimdir. */
function splitTerm(text: string): [string, string | null] {
  const i = text.indexOf(": ");
  return i > 0 ? [text.slice(0, i), text.slice(i + 2)] : [text, null];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(d);
}

/**
 * /yontem (F01): skorun yöntemi. Herkese açık, her zaman 200; kullanıcı verisi ve sayısal eşik/aralık göstermez.
 * Sağlayıcı adları FEATURE_PROVIDER_NAMES kapalıyken nötr "yapay zekâ" olarak gelir (getPublicEngineInfo).
 */
export default async function MethodPage({ searchParams }: PageProps<"/yontem">) {
  const { from } = await searchParams;
  const [t, ta, tl] = await Promise.all([getTranslations("method"), getTranslations("analysis"), getTranslations("legal.links")]);
  const info = getPublicEngineInfo();
  const ref = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(CALIBRATION_REFERENCE);

  const retention = t("data.retention");
  const linkLabel = tl("aydinlatma");
  const at = retention.indexOf(linkLabel);
  const aydinlatma = (label: string) => (
    <Link href="/yasal/aydinlatma" className="underline underline-offset-4">
      {label}
    </Link>
  );

  return (
    <article className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10">
      <MethodViewTracker from={parseMethodFrom(from)} />
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        {info.engine === "legacy" ? <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">{t("legacyNote")}</p> : null}
      </header>

      <Section id="summary" title={t("summaryTitle")}>
        <p>{t("summary")}</p>
      </Section>

      <Section id="steps" title={t("stepsTitle")}>
        <ol className="list-decimal space-y-2 pl-5">
          <li>{t("steps.s1")}</li>
          <li>{t("steps.s2")}</li>
          <li>{t("steps.s3", { provider: info.analysisProvider })}</li>
          {info.structuralSharePct !== null ? <li>{t("steps.s4", { structuralShare: info.structuralSharePct })}</li> : null}
          <li>{t("steps.s5")}</li>
        </ol>
      </Section>

      <Section id="subs" title={t("subsTitle")}>
        <table className="hidden w-full border-collapse text-left text-sm sm:table">
          <thead>
            <tr className="border-b">
              <th scope="col" className="py-2 pr-4 font-medium">{t("subsColumns.name")}</th>
              <th scope="col" className="py-2 pr-4 font-medium">{t("subsColumns.source")}</th>
              <th scope="col" className="py-2 font-medium">{t("subsColumns.kind")}</th>
            </tr>
          </thead>
          <tbody>
            {SUB_KEYS.map((k) => (
              <tr key={k} className="border-b last:border-0">
                <th scope="row" className="py-2 pr-4 font-normal">{ta(`sub.${k}`)}</th>
                <td className="py-2 pr-4 text-muted-foreground">{t(`source.${SOURCE[k]}`)}</td>
                <td className="py-2 text-muted-foreground">{ta(`kind.${SUB_KIND_HYBRID[k]}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="space-y-3 sm:hidden">
          {SUB_KEYS.map((k) => (
            <dl key={k} className="rounded-lg border p-3 text-sm">
              <div>
                <dt className="sr-only">{t("subsColumns.name")}</dt>
                <dd className="font-medium">{ta(`sub.${k}`)}</dd>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-1">
                <dt className="text-muted-foreground">{t("subsColumns.source")}:</dt>
                <dd>{t(`source.${SOURCE[k]}`)}</dd>
              </div>
              <div className="flex flex-wrap gap-x-1">
                <dt className="text-muted-foreground">{t("subsColumns.kind")}:</dt>
                <dd>{ta(`kind.${SUB_KIND_HYBRID[k]}`)}</dd>
              </div>
            </dl>
          ))}
        </div>
      </Section>

      <Section id="data" title={t("dataTitle")}>
        <dl className="space-y-2">
          {DATA_KEYS.map((k) => {
            const [term, desc] = splitTerm(t(`data.${k}`, { provider: info.analysisProvider, tryonProvider: info.tryonProvider }));
            return (
              <div key={k}>
                <dt className="inline font-medium">{desc ? `${term}:` : term}</dt>{" "}
                {desc ? <dd className="inline">{desc}</dd> : null}
              </div>
            );
          })}
        </dl>
        <p className="text-muted-foreground">
          {at >= 0 ? (
            <>
              {retention.slice(0, at)}
              {aydinlatma(linkLabel)}
              {retention.slice(at + linkLabel.length)}
            </>
          ) : (
            <>
              {retention} {aydinlatma(linkLabel)}
            </>
          )}
        </p>
      </Section>

      <Section id="fairness" title={t("fairnessTitle")}>
        <ul className="list-disc space-y-2 pl-5">
          <li>{t("fairness.f1")}</li>
          <li>{t("fairness.f2")}</li>
          <li>{t("fairness.f3")}</li>
        </ul>
        {FAIRNESS_LAST_RUN ? <p className="text-muted-foreground">{t("fairness.lastRun", { date: formatDate(FAIRNESS_LAST_RUN) })}</p> : null}
      </Section>

      <Section id="limits" title={t("limitsTitle")}>
        <ul className="list-disc space-y-2 pl-5">
          {LIMIT_KEYS.map((k) => (
            <li key={k}>{k === "l3" ? t("limits.l3", { ref }) : t(`limits.${k}`)}</li>
          ))}
        </ul>
      </Section>

      <Section id="version" title={t("versionTitle")}>
        <p className="text-muted-foreground">{t("version", { engine: info.engine, calibration: info.calibrationVersion })}</p>
      </Section>
    </article>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`method-${id}`} className="space-y-3 text-sm leading-relaxed">
      <h2 id={`method-${id}`} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}
