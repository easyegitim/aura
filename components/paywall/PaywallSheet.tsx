"use client";

import { ArrowLeft, BookOpen, CalendarCheck, Camera, ChartLine, ListChecks, Sparkles, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { track } from "@/lib/analytics";
import { TEASER_ANALYTICS_CODE, type PaywallTrigger } from "@/lib/config/paywall";
import { DEFAULT_PLAN_ID, PLANS, SUBSCRIPTION_PLAN_IDS, formatTry, weeklyEquivalentTry, type SubscriptionPlanId } from "@/lib/config/plans";
import { SUB_KEYS, type SubKey, type TeaserMode } from "@/lib/config/teaser";
import { cn } from "@/lib/utils";

export type PlanChoice = SubscriptionPlanId | "week_pass";
type Step = "benefits" | "plans";
type Ctx = { open: (trigger: PaywallTrigger) => void };
const PaywallContext = createContext<Ctx | null>(null);

type ContextKey = "score" | "potential" | "sub" | "improve" | "measurements" | "plan";

/** Tetikleyiciye göre sayfa 1'deki bağlam satırı (UI spec §4.1). sub_<k> yalnız kilitli bir alt skor için vardır. */
export function paywallContext(trigger: PaywallTrigger): { key: ContextKey; sub?: SubKey } {
  switch (trigger) {
    case "score_main":
      return { key: "score" };
    case "score_potential":
      return { key: "potential" };
    case "improve_first":
      return { key: "improve" };
    case "measurements":
      return { key: "measurements" };
    case "plan":
    case "plan_page":
      return { key: "plan" };
    default: {
      const sub = SUB_KEYS.find((k) => trigger === `sub_${k}`);
      return sub ? { key: "sub", sub } : { key: "score" };
    }
  }
}

const BENEFITS: { k: "i1" | "i2" | "i3" | "i4" | "i5" | "i6"; icon: LucideIcon }[] = [
  { k: "i1", icon: ChartLine },
  { k: "i2", icon: ListChecks },
  { k: "i3", icon: Sparkles },
  { k: "i4", icon: CalendarCheck },
  { k: "i5", icon: BookOpen },
  { k: "i6", icon: Camera },
];

const PER_KEY: Record<SubscriptionPlanId, "perWeek" | "perMonth" | "perYear"> = { weekly: "perWeek", monthly: "perMonth", yearly: "perYear" };

/**
 * Kilitli alanlara dokununca açılan iki sayfalı plan sheet'i (UI spec §4.1, F14).
 * Sayfa 1: faydalar + tek ₺ satırı. Sayfa 2: planlar (yıllık seçili). İstemci kilit açmaz; ödeme /premium'da.
 */
export function PaywallProvider({
  teaserMode,
  analysisId,
  weekPassEnabled = false,
  children,
}: {
  teaserMode: TeaserMode;
  analysisId?: string;
  weekPassEnabled?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("paywall");
  const tp = useTranslations("pricing");
  const tc = useTranslations("checkout");
  const ta = useTranslations("analysis");
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<PaywallTrigger>("score_main");
  const [step, setStep] = useState<Step>("benefits");
  const [plan, setPlan] = useState<PlanChoice>(DEFAULT_PLAN_ID);
  const plansHeadingRef = useRef<HTMLHeadingElement>(null);
  const seePlansRef = useRef<HTMLButtonElement>(null);
  const movedRef = useRef(false);
  const plansHeadingId = useId();

  function show(tr: PaywallTrigger) {
    setTrigger(tr);
    setStep("benefits");
    setPlan(DEFAULT_PLAN_ID);
    movedRef.current = false;
    setOpen(true);
    track("paywall_viewed", { trigger: tr, teaserMode: TEASER_ANALYTICS_CODE[teaserMode] });
  }

  function onOpenChange(next: boolean) {
    if (!next && open) track("paywall_dismissed", { step });
    setOpen(next);
  }

  function goPlans() {
    movedRef.current = true;
    setStep("plans");
    track("paywall_step_viewed", { step: "plans", trigger });
  }

  function goBenefits() {
    movedRef.current = true;
    setStep("benefits");
  }

  function choose(value: string) {
    const next = value === "week_pass" ? (weekPassEnabled ? "week_pass" : null) : SUBSCRIPTION_PLAN_IDS.find((id) => id === value) ?? null;
    if (!next) return;
    setPlan(next);
    track("paywall_plan_selected", { plan: next });
  }

  // Sayfa değişince odak yeni sayfanın başına taşınır (UI spec §8.3); ilk açılışta Radix odağı yönetir.
  useEffect(() => {
    if (!movedRef.current) return;
    if (step === "plans") plansHeadingRef.current?.focus();
    else seePlansRef.current?.focus();
  }, [step]);

  const ctx = paywallContext(trigger);
  const contextLine = ctx.key === "sub" && ctx.sub ? t("context.sub", { name: ta(`sub.${ctx.sub}`) }) : t(`context.${ctx.key}`);
  const href = `/premium?plan=${plan}&from=${encodeURIComponent(trigger)}${analysisId ? `&analysis=${encodeURIComponent(analysisId)}` : ""}`;

  return (
    <PaywallContext.Provider value={{ open: show }}>
      {children}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-2xl p-0">
          {step === "benefits" ? (
            <>
              <SheetHeader className="pr-12">
                <SheetTitle>{t("title")}</SheetTitle>
                <SheetDescription>{t("body")}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-4">
                <p className="text-sm font-medium">{contextLine}</p>
                <ul className="space-y-2">
                  {BENEFITS.map(({ k, icon: Icon }) => (
                    <li key={k} className="flex items-start gap-3 text-sm">
                      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{t(`includes.${k}`)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">{t("notAssessedNote")}</p>
                <Link href="/yontem?from=paywall" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">
                  {t("methodLink")}
                </Link>
              </div>
              <div className="sticky bottom-0 space-y-2 border-t bg-background px-4 pt-3 pb-6">
                <p className="text-center text-sm font-medium tabular-nums">
                  {t("anchor", { yearly: formatTry(PLANS.yearly.priceTry), weekly: formatTry(weeklyEquivalentTry("yearly")) })}
                </p>
                <Button ref={seePlansRef} type="button" size="lg" className="w-full" onClick={goPlans}>
                  {t("seePlans")}
                </Button>
                <p className="text-xs text-muted-foreground">{t("note")}</p>
              </div>
            </>
          ) : (
            <>
              <SheetHeader className="pr-12">
                <SheetTitle className="sr-only">{t("title")}</SheetTitle>
                <SheetDescription className="sr-only">{t("body")}</SheetDescription>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={t("backAria")} onClick={goBenefits}>
                    <ArrowLeft aria-hidden="true" />
                  </Button>
                  <h3 id={plansHeadingId} ref={plansHeadingRef} tabIndex={-1} className="text-base font-semibold outline-none">
                    {t("plansTitle")}
                  </h3>
                </div>
              </SheetHeader>
              <div className="px-4 pb-4">
                <RadioGroup aria-labelledby={plansHeadingId} value={plan} onValueChange={choose} className="gap-2">
                  {SUBSCRIPTION_PLAN_IDS.map((id) => (
                    <PlanOption
                      key={id}
                      id={id}
                      selected={plan === id}
                      name={tp(`plans.${id}.name`)}
                      price={`${formatTry(PLANS[id].priceTry)} / ${tp(PER_KEY[id])}`}
                      detail={id === "weekly" ? null : tp("weeklyEquivalent", { amount: formatTry(weeklyEquivalentTry(id)) })}
                      badge={id === "weekly" ? null : `${tp(`plans.${id}.badge`)} ${tp("vsWeekly")}`}
                    />
                  ))}
                  {weekPassEnabled ? (
                    <PlanOption
                      id="week_pass"
                      selected={plan === "week_pass"}
                      name={tc("weekPass")}
                      price={formatTry(PLANS.week_pass.priceTry)}
                      detail={tc("weekPassHint")}
                      badge={null}
                    />
                  ) : null}
                </RadioGroup>
              </div>
              <div className="sticky bottom-0 space-y-2 border-t bg-background px-4 pt-3 pb-6">
                <Button asChild size="lg" className="w-full">
                  <Link href={href}>{t("continueWith", { price: formatTry(PLANS[plan].priceTry) })}</Link>
                </Button>
                <p className="text-xs text-muted-foreground">{tp("autoRenewNote")}</p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </PaywallContext.Provider>
  );
}

function PlanOption({ id, selected, name, price, detail, badge }: { id: PlanChoice; selected: boolean; name: string; price: string; detail: string | null; badge: string | null }) {
  const base = useId();
  const nameId = `${base}-name`;
  const descId = `${base}-desc`;
  return (
    <label
      className={cn(
        "flex min-h-11 w-full cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        selected ? "border-foreground ring-1 ring-foreground" : "hover:bg-accent",
      )}
    >
      <RadioGroupItem value={id} aria-labelledby={nameId} aria-describedby={descId} className="mt-0.5" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span id={nameId} className="font-medium">{name}</span>
          <span className="font-semibold tabular-nums">{price}</span>
        </span>
        <span id={descId} className="mt-1 block space-y-1 text-xs text-muted-foreground">
          {detail ? <span className="block">{detail}</span> : null}
          {badge ? (
            <Badge variant="secondary" className="h-auto whitespace-normal text-left">
              {badge}
            </Badge>
          ) : null}
        </span>
      </span>
    </label>
  );
}

export function usePaywall(): Ctx {
  const ctx = useContext(PaywallContext);
  if (!ctx) throw new Error("usePaywall PaywallProvider içinde kullanılmalı");
  return ctx;
}
