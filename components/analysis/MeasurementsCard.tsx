"use client";

import { Ruler } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { LockedSection } from "@/components/analysis/LockedSection";
import type { PaywallTrigger } from "@/lib/config/paywall";
import type { ClientAnalysis } from "@/lib/score/present";

const pct = (v: number | null) => (v === null ? "–" : `%${Math.round(v * 100)}`);
/** Türkçe ondalık virgülü: "1,90" (diğer skorlarla aynı biçim). */
const ratio = (v: number) => v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ROWS = ["canthalTilt", "thirds", "fwhr", "jawRatio"] as const;

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-20 flex-col justify-between gap-2 rounded-xl bg-muted/60 p-3">
      <dt className="text-[11px] leading-tight text-muted-foreground">{label}</dt>
      <dd className="num text-base leading-tight font-semibold">{children}</dd>
    </div>
  );
}

/** Oranlar (UI spec §2.7): kilitliyken adlandırılmış kutular "●,●" ile görünür, değer yoktur. */
export function MeasurementsCard({ a, onLocked }: { a: ClientAnalysis; onLocked: (t: PaywallTrigger) => void }) {
  const t = useTranslations("analysis");
  const tg = useTranslations("geometry");
  const metrics = a.metrics.locked ? null : a.metrics.value;
  return (
    <LockedSection
      title={t("ratiosTitle")}
      icon={<Ruler className="size-4" />}
      ctaVariant="outline"
      locked={a.metrics.locked}
      onTap={() => onLocked("measurements")}
      preview={
        <dl className="grid grid-cols-2 gap-2">
          {ROWS.map((k) => (
            <Tile key={k} label={tg(k)}>
              <span className="text-muted-foreground blur-[1px]" aria-hidden="true">
                ●,●
              </span>
            </Tile>
          ))}
        </dl>
      }
    >
      {metrics ? (
        <dl className="grid grid-cols-2 gap-2">
          <Tile label={tg("canthalTilt")}>
            <span className="text-sm">
              {metrics.canthalTiltDeg > 2 ? tg("tilt.positive") : metrics.canthalTiltDeg < -2 ? tg("tilt.negative") : tg("tilt.neutral")}
            </span>
          </Tile>
          <Tile label={tg("thirds")}>
            <span className="text-sm whitespace-nowrap">
              {pct(metrics.thirds.upper)} / {pct(metrics.thirds.middle)} / {pct(metrics.thirds.lower)}
            </span>
          </Tile>
          <Tile label={tg("fwhr")}>{ratio(metrics.fwhr)}</Tile>
          <Tile label={tg("jawRatio")}>{ratio(metrics.jawRatio)}</Tile>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">–</p>
      )}
    </LockedSection>
  );
}
