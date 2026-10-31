"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { GeometryOverlay, type OverlaySource } from "@/components/analysis/GeometryOverlay";
import { PROGRESS_STAGES, progressValue, type ProgressStage, type ProgressState } from "@/lib/analysis/progressModel";
import type { EngineName } from "@/lib/score/contract";
import { cn } from "@/lib/utils";

const SLOW_AFTER_MS = 30_000;
const TICK_MS = 250;

/**
 * Adımlı analiz ilerlemesi (UI spec §3, SPEC 4.1 adım 7, yalnız web). Adımlar gerçek işe bağlıdır: ilk ikisi gönderimden
 * önce bitmiştir, "hazırlık" kırpım bitince, "gözlem" yanıt gelince, "skor" yanıttan hemen sonra tamamlanır.
 */
export function AnalysisProgress({ state, engine, source }: { state: ProgressState; engine: EngineName; source: OverlaySource | null }) {
  const t = useTranslations("analysis.progress.v2");
  const [now, setNow] = useState(() => state.startedAt);

  useEffect(() => {
    if (state.finished) return;
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [state.finished]);

  const label = (s: ProgressStage) => (s === "observe" ? t(engine === "hybrid.v1" ? "observe" : "observeLegacy") : t(s));
  const value = Math.round(progressValue(state, now));
  // Canlı bölge yalnız adım değişince duyurur (her tikte değil).
  const announcement = state.finished ? t("ready") : state.active ? label(state.active) : "";

  return (
    <div className="space-y-5 py-2">
      <div className="space-y-1 text-center">
        <p className="eyebrow">{state.finished ? t("ready") : t("title")}</p>
        <p className="num text-5xl leading-none font-bold text-brand-gradient" aria-hidden="true">
          {value}
          <span className="text-2xl">%</span>
        </p>
      </div>
      <GeometryOverlay source={source} variant="scan" />
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <div aria-hidden="true" className="mx-auto h-2 max-w-[280px] overflow-hidden rounded-full bg-track">
        <div className="h-full rounded-full bg-brand-gradient transition-[width] duration-300 ease-out" style={{ width: `${value}%` }} />
      </div>
      <ol className="mx-auto max-w-sm space-y-1.5 text-sm">
        {PROGRESS_STAGES.map((s) => {
          const done = state.done.includes(s);
          const active = state.active === s;
          return (
            <li
              key={s}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 transition-colors",
                active && "bg-brand-soft font-semibold",
                !done && !active && "text-muted-foreground",
              )}
              aria-current={active ? "step" : undefined}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full",
                  done && "bg-cta-gradient text-primary-foreground",
                  active && "text-brand",
                  !done && !active && "bg-muted",
                )}
              >
                {done ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : active ? (
                  <LoaderCircle className="size-5 motion-safe:animate-spin" />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" />
                )}
              </span>
              <span className="leading-snug">
                {label(s)}
                {done ? <span className="sr-only"> {t("doneSr")}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-center text-[11px] text-muted-foreground">{t("hint")}</p>
      {!state.finished && now - state.startedAt > SLOW_AFTER_MS ? <p className="text-center text-xs">{t("slow")}</p> : null}
    </div>
  );
}
