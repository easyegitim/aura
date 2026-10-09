"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { track } from "@/lib/analytics";
import { DEFAULT_PLAN_ID, PLANS, SUBSCRIPTION_PLAN_IDS, formatTry } from "@/lib/config/plans";
import type { TeaserMode } from "@/lib/config/teaser";
import { cn } from "@/lib/utils";

type Ctx = { open: (trigger: string) => void };
const PaywallContext = createContext<Ctx | null>(null);

/** Kilitli alanlara dokununca açılan plan sheet'i (SPEC 4.2 /analiz/[id], F08). Ödeme akışı /premium'da (Faz 8). */
export function PaywallProvider({ teaserMode, children }: { teaserMode: TeaserMode; children: ReactNode }) {
  const t = useTranslations("paywall");
  const tp = useTranslations("pricing");
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState("");

  function show(tr: string) {
    setTrigger(tr);
    setOpen(true);
    track("paywall_viewed", { trigger: tr, teaserMode });
  }

  return (
    <PaywallContext.Provider value={{ open: show }}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{t("title")}</SheetTitle>
            <SheetDescription>{t("body")}</SheetDescription>
          </SheetHeader>
          <ul className="space-y-2 px-4">
            {(["i1", "i2", "i3", "i4"] as const).map((k) => (
              <li key={k} className="text-sm">
                • {t(`includes.${k}`)}
              </li>
            ))}
          </ul>
          <div className="grid gap-2 px-4 py-4">
            {SUBSCRIPTION_PLAN_IDS.map((id) => (
              <Link
                key={id}
                href={`/premium?plan=${id}&from=${encodeURIComponent(trigger)}`}
                className={cn("flex items-center justify-between rounded-lg border px-4 py-3 text-sm hover:bg-accent", id === DEFAULT_PLAN_ID && "border-foreground")}
              >
                <span className="flex items-center gap-2">
                  {tp(`plans.${id}.name`)}
                  {id !== "weekly" ? <Badge variant="secondary">{tp(`plans.${id}.badge`)}</Badge> : null}
                </span>
                <span className="font-semibold tabular-nums">{formatTry(PLANS[id].priceTry)}</span>
              </Link>
            ))}
          </div>
          <div className="px-4 pb-6">
            <Button asChild className="w-full" size="lg">
              <Link href={`/premium?plan=${DEFAULT_PLAN_ID}&from=${encodeURIComponent(trigger)}`}>{t("cta")}</Link>
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">{t("note")}</p>
          </div>
        </SheetContent>
      </Sheet>
    </PaywallContext.Provider>
  );
}

export function usePaywall(): Ctx {
  const ctx = useContext(PaywallContext);
  if (!ctx) throw new Error("usePaywall PaywallProvider içinde kullanılmalı");
  return ctx;
}
