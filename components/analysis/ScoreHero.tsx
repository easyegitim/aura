"use client";

import { ArrowUpRight, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { GeometryOverlay, type OverlayLayerKey, type OverlaySource } from "@/components/analysis/GeometryOverlay";
import { LockedValue, fmtScore } from "@/components/analysis/LockedValue";
import { OverlayDialog } from "@/components/analysis/OverlayDialog";
import { ReferenceScale } from "@/components/analysis/ReferenceScale";
import { Card, CardContent } from "@/components/ui/card";
import { track } from "@/lib/analytics";
import type { PaywallTrigger } from "@/lib/config/paywall";
import { CALIBRATION_REFERENCE } from "@/lib/config/scoring";
import type { ClientAnalysis } from "@/lib/score/present";
import { cn } from "@/lib/utils";

/** Açılış zamanlaması (UI spec §2.8): çizgiler 6 × 150 ms, sonra 700 ms sayaç, sonra çip. */
export const REVEAL_LINES_MS = 900;
export const REVEAL_COUNT_MS = 700;

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** Açık genel skorun 0'dan sayarak görünmesi (yalnız gösterim; ekran okuyucu son değeri okur). */
function useCountUp(target: number | null, run: boolean): number | null {
  const [shown, setShown] = useState<number | null>(run && target !== null ? 0 : target);
  useEffect(() => {
    if (!run || target === null || reducedMotion()) {
      const id = requestAnimationFrame(() => setShown(target));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    const startAt = performance.now() + REVEAL_LINES_MS;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - startAt) / REVEAL_COUNT_MS));
      setShown(Math.round(target * (1 - (1 - p) ** 3) * 10) / 10);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  return shown;
}

export function ScoreHero({
  a,
  onLocked,
  reveal,
  showLegacyNote,
  source,
  notMeasured,
}: {
  a: ClientAnalysis;
  onLocked: (t: PaywallTrigger) => void;
  reveal: boolean;
  showLegacyNote: boolean;
  /** Bu analize bağlı bellekteki selfie; yoksa şematik yüz. */
  source: OverlaySource | null;
  notMeasured: OverlayLayerKey[];
}) {
  const t = useTranslations("analysis");
  const tg = useTranslations("geometry");
  const [overlayOpen, setOverlayOpen] = useState(false);

  const overall = a.overall.locked ? null : a.overall.value;
  const shown = useCountUp(overall, reveal);
  const potential = a.potential.locked ? null : a.potential.value;
  const delta = a.potentialDelta.locked ? null : a.potentialDelta.value;
  const chipDelay = reveal ? { animationDelay: `${REVEAL_LINES_MS + REVEAL_COUNT_MS}ms` } : undefined;

  function openOverlay() {
    setOverlayOpen(true);
    track("overlay_opened", { source: source ? "photo" : "schematic" });
  }

  let chip: ReactNode = null;
  if (a.potential.locked) {
    // DOM'da /potansiyel|kilidi aç|premium/i ile eşleşen ilk düğme budur (e2e).
    chip = (
      <button
        type="button"
        onClick={() => onLocked("score_potential")}
        aria-label={t("lockedAriaFor", { name: t("hero.potentialLockedName") })}
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          reveal && "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:fill-mode-both motion-safe:duration-300",
        )}
        style={chipDelay}
      >
        <ArrowUpRight className="size-4" aria-hidden="true" />
        <span aria-hidden="true">{t("hero.potentialLocked")}</span>
        <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </button>
    );
  } else if (potential !== null) {
    chip = (
      <p
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
          reveal && "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:fill-mode-both motion-safe:duration-300",
        )}
        style={chipDelay}
      >
        <ArrowUpRight className="size-4" aria-hidden="true" />
        {delta !== null && delta < 0.1
          ? t("hero.potentialAtTop")
          : t("hero.potentialOpen", { potential: fmtScore(potential), delta: fmtScore(delta ?? 0) })}
      </p>
    );
  }

  return (
    <section className="space-y-3" aria-labelledby="hero-title">
      <Card>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={openOverlay}
              aria-label={t("overlay.open")}
              className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <GeometryOverlay source={source} variant="thumb" animate={reveal} notMeasured={notMeasured} />
            </button>
            <div className="min-w-0 flex-1 space-y-2">
              <h2 id="hero-title" className="font-semibold leading-none">
                {t("overallTitle")}
              </h2>
              {showLegacyNote ? <p className="text-xs text-muted-foreground">{t("legacyNote")}</p> : null}
              {a.overall.locked ? (
                <LockedValue
                  v={a.overall}
                  big
                  pop={reveal}
                  onTap={() => onLocked("score_main")}
                  aria={t("lockedAriaFor", { name: t("overallTitle") })}
                />
              ) : (
                <p className="flex items-baseline gap-1">
                  <span className="text-6xl font-semibold tabular-nums" aria-hidden="true">
                    {shown === null ? "–" : fmtScore(shown)}
                  </span>
                  <span className="sr-only">{overall === null ? "–" : fmtScore(overall)}</span>
                  <span className="text-lg text-muted-foreground">{t("hero.outOf")}</span>
                </p>
              )}
              {chip}
              {chip ? <p className="text-xs text-muted-foreground">{t("hero.potentialCaption")}</p> : null}
            </div>
          </div>
          <p className="text-sm">
            {tg("faceShape")}: <strong>{a.faceShape ? tg(`shapes.${a.faceShape}`) : "–"}</strong>
            {a.faceShapeDetail?.secondary ? ` (${tg("between", { other: tg(`shapes.${a.faceShapeDetail.secondary}`) })})` : null}
          </p>
        </CardContent>
      </Card>
      <ReferenceScale reference={CALIBRATION_REFERENCE} value={overall} />
      <p className="text-xs text-muted-foreground">{t("reference.note", { ref: fmtScore(CALIBRATION_REFERENCE) })}</p>
      <p className="text-xs">
        <Link href="/yontem?from=result" className="underline underline-offset-4">
          {t("reference.methodLink")}
        </Link>
      </p>
      <p className="text-xs text-muted-foreground">{a.engine === "hybrid.v1" ? t("disclaimerHybrid") : t("disclaimer")}</p>
      <OverlayDialog open={overlayOpen} onOpenChange={setOverlayOpen} source={source} notMeasured={notMeasured} />
    </section>
  );
}
