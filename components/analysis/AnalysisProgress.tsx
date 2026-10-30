"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { GeometryOverlay, type OverlaySource } from "@/components/analysis/GeometryOverlay";
import { Progress } from "@/components/ui/progress";
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
    <div className="space-y-5 py-6">
      <GeometryOverlay source={source} variant="scan" />
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <ol className="mx-auto max-w-sm space-y-2 text-sm">
        {PROGRESS_STAGES.map((s) => {
          const done = state.done.includes(s);
          const active = state.active === s;
          return (
            <li key={s} className={cn("flex items-start gap-2", !done && !active && "text-muted-foreground")} aria-current={active ? "step" : undefined}>
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                {done ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : active ? (
                  <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                )}
              </span>
              <span>
                {label(s)}
                {done ? <span className="sr-only"> {t("doneSr")}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      <Progress value={value} className="mx-auto max-w-xs" aria-hidden="true" />
      {state.finished ? <p className="text-center font-medium">{t("ready")}</p> : null}
      <p className="text-center text-xs text-muted-foreground">{t("hint")}</p>
      {!state.finished && now - state.startedAt > SLOW_AFTER_MS ? <p className="text-center text-xs">{t("slow")}</p> : null}
    </div>
  );
}
