"use client";

import { Lock } from "lucide-react";
import type { Locked } from "@/lib/score/present";
import { cn } from "@/lib/utils";

export const fmtScore = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Kilitli değer: gerçek değer istemcide yoktur; "●,●" + kilit, dokununca paywall (SPEC 5.3).
 * aria adı alanı söyler ("Genel skorun kilitli; açmak için dokun"); dokunma hedefi ≥ 44 px.
 */
export function LockedValue({
  v,
  big = false,
  onTap,
  aria,
  pop = false,
  className,
}: {
  v: Locked<number | null>;
  big?: boolean;
  onTap: () => void;
  aria: string;
  /** Açılış gösteriminde kilit 0,9 → 1 ölçeklenir (azaltılmış harekette yok). */
  pop?: boolean;
  className?: string;
}) {
  if (v.locked) {
    return (
      <button
        type="button"
        onClick={onTap}
        aria-label={aria}
        className={cn(
          "inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md tabular-nums text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          big ? "text-5xl font-semibold" : "text-base",
          pop && "motion-safe:animate-in motion-safe:zoom-in-90 motion-safe:duration-300",
          className,
        )}
      >
        <span aria-hidden="true">●,●</span>
        <Lock className={big ? "size-6" : "size-3.5"} aria-hidden="true" />
      </button>
    );
  }
  return <span className={cn("tabular-nums", big && "text-5xl font-semibold", className)}>{v.value === null ? "–" : fmtScore(v.value)}</span>;
}
