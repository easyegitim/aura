"use client";

import { useTranslations } from "next-intl";
import { fmtScore } from "@/components/analysis/LockedValue";

const MIN = 1;
const MAX = 10;
const pos = (v: number) => `${((Math.min(Math.max(v, MIN), MAX) - MIN) / (MAX - MIN)) * 100}%`;

/**
 * 1–10 nötr ölçek (UI spec §2.4): herkes için aynı referans çizgisi + (açıksa) kullanıcının işareti.
 * Renk skalası, iyi/kötü rengi, yüzdelik veya "ortalama" yok.
 */
export function ReferenceScale({ reference, value }: { reference: number; value: number | null }) {
  const t = useTranslations("analysis.reference");
  const ref = fmtScore(reference);
  return (
    <div
      role="img"
      aria-label={value === null ? t("ariaLocked", { ref }) : t("aria", { ref, value: fmtScore(value) })}
      className="space-y-1"
    >
      <div className="relative h-2 rounded-full bg-muted outline outline-1 -outline-offset-1 outline-foreground/30">
        <span className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-foreground" style={{ left: pos(reference) }} />
        {value !== null ? (
          <span
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-background"
            style={{ left: pos(value) }}
          />
        ) : null}
      </div>
      <div className="relative h-4 text-xs text-muted-foreground" aria-hidden="true">
        <span className="absolute left-0">{MIN}</span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pos(reference) }}>
          {t("tick", { ref })}
        </span>
        <span className="absolute right-0">{MAX}</span>
      </div>
    </div>
  );
}
