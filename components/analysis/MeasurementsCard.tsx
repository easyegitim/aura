"use client";

import { useTranslations } from "next-intl";
import { LockedSection } from "@/components/analysis/LockedSection";
import type { PaywallTrigger } from "@/lib/config/paywall";
import type { ClientAnalysis } from "@/lib/score/present";

const pct = (v: number | null) => (v === null ? "–" : `%${Math.round(v * 100)}`);
const ROWS = ["canthalTilt", "thirds", "fwhr", "jawRatio"] as const;

/** Oranlar (UI spec §2.7): kilitliyken adlandırılmış satırlar "●,●" ile görünür, değer yoktur. */
export function MeasurementsCard({ a, onLocked }: { a: ClientAnalysis; onLocked: (t: PaywallTrigger) => void }) {
  const t = useTranslations("analysis");
  const tg = useTranslations("geometry");
  const metrics = a.metrics.locked ? null : a.metrics.value;
  return (
    <LockedSection
      title={t("ratiosTitle")}
      locked={a.metrics.locked}
      onTap={() => onLocked("measurements")}
      preview={
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
          {ROWS.map((k) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{tg(k)}</dt>
              <dd className="tabular-nums text-muted-foreground" aria-hidden="true">
                ●,●
              </dd>
            </div>
          ))}
        </dl>
      }
    >
      {metrics ? (
        <>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{tg("canthalTilt")}</dt>
            <dd>{metrics.canthalTiltDeg > 2 ? tg("tilt.positive") : metrics.canthalTiltDeg < -2 ? tg("tilt.negative") : tg("tilt.neutral")}</dd>
            <dt className="text-muted-foreground">{tg("thirds")}</dt>
            <dd className="tabular-nums">
              {pct(metrics.thirds.upper)} / {pct(metrics.thirds.middle)} / {pct(metrics.thirds.lower)}
            </dd>
            <dt className="text-muted-foreground">{tg("fwhr")}</dt>
            <dd className="tabular-nums">{metrics.fwhr.toFixed(2)}</dd>
            <dt className="text-muted-foreground">{tg("jawRatio")}</dt>
            <dd className="tabular-nums">{metrics.jawRatio.toFixed(2)}</dd>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">{a.engine === "hybrid.v1" ? tg("noteV2") : tg("note")}</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">–</p>
      )}
    </LockedSection>
  );
}
