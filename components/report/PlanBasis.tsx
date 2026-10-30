"use client";

import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { track } from "@/lib/analytics";
import { goalMatch, leverSection, type BasisChip, type Goal, type ReportSection } from "@/lib/coach/planBasis";
import { GOALS } from "@/lib/questionnaire";
import type { ImproveItem } from "@/lib/score/contract";

/** Çip anahtarı → questionnaire.options grubu (değer çevirisi için). */
const OPTION_GROUP: Partial<Record<BasisChip["key"], string>> = {
  goal: "goals",
  skinType: "skinType",
  budget: "budget",
  hairType: "hairType",
  beard: "beardPreference",
};

type Props = {
  analysisId: string;
  basis: BasisChip[];
  improveFirst: ImproveItem[] | null;
  /** Raporda gerçekten gösterilen bölümler: öncelik maddesi yalnız bunlara bağlanır. */
  rendered: ReadonlySet<ReportSection>;
  stale: boolean;
};

/** "Planın şunlara göre hazırlandı" (UI spec §7, F09): anket çipleri, öncelik sırası, hedef eşleşmesi, düzenleme bağlantısı. */
export function PlanBasis({ analysisId, basis, improveFirst, rendered, stale }: Props) {
  const t = useTranslations("report.basis");
  const tq = useTranslations("questionnaire.options");
  const ta = useTranslations("analysis.levers");

  const optionLabel = (group: string, value: string | number | undefined) => {
    const k = `${group}.${String(value)}`;
    return tq.has(k) ? tq(k) : String(value ?? "");
  };
  const chipLabel = (c: BasisChip) => {
    if (c.key === "minutes") return t("chip.minutes", { n: Number(c.values?.n ?? 0) });
    const group = OPTION_GROUP[c.key];
    return group ? t(`chip.${c.key}`, { value: optionLabel(group, c.values?.value) }) : t(`chip.${c.key}`);
  };

  const goals: Goal[] = basis.flatMap((c) => (c.key === "goal" ? GOALS.filter((g) => g === c.values?.value) : []));
  const items = improveFirst ?? [];
  const match = goalMatch(goals, items[0]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{stale ? t("titleCurrent") : t("title")}</CardTitle>
        {stale ? <CardDescription>{t("staleNote")}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="flex flex-wrap gap-2" aria-label={stale ? t("titleCurrent") : t("title")}>
          {basis.map((c, i) => (
            <li key={`${c.key}-${i}`}>
              <Badge variant="secondary" className="h-auto whitespace-normal">
                {chipLabel(c)}
              </Badge>
            </li>
          ))}
        </ul>

        {items.length ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">{t("priorities")}</h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {items.map((it) => {
                const section = leverSection(it.lever);
                const label = ta.has(it.lever) ? ta(it.lever) : it.lever;
                return (
                  <li key={it.lever}>
                    {section && rendered.has(section) ? (
                      <a href={`#section-${section}`} className="underline underline-offset-4">
                        {label}
                      </a>
                    ) : (
                      label
                    )}
                  </li>
                );
              })}
            </ol>
            {match ? <p className="text-xs text-muted-foreground">{t("goalMatch", { goal: optionLabel("goals", match) })}</p> : null}
          </div>
        ) : null}

        <Link
          href={`/baslangic/anket?next=${encodeURIComponent(`/plan/${analysisId}`)}`}
          onClick={() => track("plan_basis_edit_clicked")}
          className="inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4"
        >
          <Pencil aria-hidden="true" className="size-4" />
          {t("edit")}
        </Link>
      </CardContent>
    </Card>
  );
}
