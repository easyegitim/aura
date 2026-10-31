"use client";

import { ArrowLeft, ArrowRight, ArrowUpRight, ChartLine, ChevronDown, Gauge, ListChecks, Lock, Ruler, ScanFace, Sparkles, X, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { track } from "@/lib/analytics";
import { TEASER_ANALYTICS_CODE, type PaywallTrigger } from "@/lib/config/paywall";
import { DEFAULT_PLAN_ID, PLANS, SUBSCRIPTION_PLAN_IDS, formatTry, weeklyEquivalentTry, type SubscriptionPlanId } from "@/lib/config/plans";
import { SUB_KEYS, type SubKey, type TeaserMode } from "@/lib/config/teaser";
import { cn } from "@/lib/utils";
import { PlanBody, PlanCheck, PlanRibbon, planCardClass } from "@/components/billing/PlanOption";

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

/** Sayfa 1 fayda kutuları: kısa etiketler (F08); uzun açıklama "Ayrıntılar" altında. Hiçbirinde fiyat yok. */
const PERKS: { k: "score" | "subs" | "plan" | "tryon" | "trend" | "steps"; icon: LucideIcon }[] = [
  { k: "score", icon: Gauge },
  { k: "subs", icon: ChartLine },
  { k: "plan", icon: ListChecks },
  { k: "tryon", icon: ScanFace },
  { k: "trend", icon: Sparkles },
  { k: "steps", icon: Ruler },
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
  const tCommon = useTranslations("common");
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
        <SheetContent side="bottom" showCloseButton={false} className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-3xl border-t bg-background p-0">
          <div aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
          <SheetClose asChild>
            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 rounded-full text-muted-foreground" aria-label={tCommon("close")}>
              <X aria-hidden="true" className="size-5" />
            </Button>
          </SheetClose>
          {step === "benefits" ? (
            <>
              <SheetHeader className="items-center bg-hero-glow px-5 pt-5 pb-4 text-center">
                <span aria-hidden="true" className="mb-1 grid size-14 place-items-center rounded-2xl bg-cta-gradient text-primary-foreground shadow-glow">
                  <Sparkles className="size-7" />
                </span>
                <p className="eyebrow">{t("eyebrow")}</p>
                <SheetTitle className="text-2xl font-bold tracking-tight">{t("title")}</SheetTitle>
                <SheetDescription className="text-[13px]">{t("lead")}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-5 pb-5">
                <p className="flex items-start gap-2.5 rounded-xl bg-brand-soft px-3.5 py-3 text-[13px] font-medium">
                  <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
                  <span>{contextLine}</span>
                </p>
                <ul aria-label={t("perksAria")} className="grid grid-cols-2 gap-2">
                  {PERKS.map(({ k, icon: Icon }, i) => (
                    <li
                      key={k}
                      className="flex min-h-14 items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 motion-safe:animate-fade-up"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                        <Icon className="size-4" />
                      </span>
                      <span className="text-[13px] leading-tight font-semibold">{t(`perks.${k}`)}</span>
                    </li>
                  ))}
                </ul>
                <details className="group">
                  <summary className="flex min-h-11 cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground">
                    {t("details")}
                    <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="space-y-2 pb-1 text-[13px] leading-relaxed text-muted-foreground">
                    <p>{t("body")}</p>
                    <p>{t("notAssessedNote")}</p>
                    <Link href="/yontem?from=paywall" className="inline-flex min-h-11 items-center gap-1 font-semibold text-brand underline-offset-4 hover:underline">
                      {t("methodLink")}
                      <ArrowUpRight aria-hidden="true" className="size-4" />
                    </Link>
                  </div>
                </details>
              </div>
              <div className="sticky bottom-0 space-y-2.5 border-t bg-background/90 px-5 pt-3.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
                <p className="num text-center text-sm font-semibold">
                  {t("anchor", { yearly: formatTry(PLANS.yearly.priceTry), weekly: formatTry(weeklyEquivalentTry("yearly")) })}
                </p>
                <Button ref={seePlansRef} type="button" size="lg" className="w-full" onClick={goPlans}>
                  {t("seePlans")}
                  <ArrowRight aria-hidden="true" />
                </Button>
                <p className="text-center text-[11px] leading-relaxed text-muted-foreground">{t("note")}</p>
              </div>
            </>
          ) : (
            <>
              <SheetHeader className="px-3 pt-1 pb-3">
                <SheetTitle className="sr-only">{t("title")}</SheetTitle>
                <SheetDescription className="sr-only">{t("body")}</SheetDescription>
                <div className="flex items-center gap-1 pr-12">
                  <Button type="button" variant="ghost" size="icon" className="rounded-full" aria-label={t("backAria")} onClick={goBenefits}>
                    <ArrowLeft aria-hidden="true" className="size-5" />
                  </Button>
                  <h3 id={plansHeadingId} ref={plansHeadingRef} tabIndex={-1} className="text-xl font-bold tracking-tight outline-none">
                    {t("plansTitle")}
                  </h3>
                </div>
              </SheetHeader>
              <div className="px-5 pb-5">
                <RadioGroup aria-labelledby={plansHeadingId} value={plan} onValueChange={choose} className="gap-2.5">
                  {SUBSCRIPTION_PLAN_IDS.map((id) => (
                    <PlanOption
                      key={id}
                      id={id}
                      selected={plan === id}
                      featured={id === DEFAULT_PLAN_ID}
                      featuredLabel={t("bestValue")}
                      name={tp(`plans.${id}.name`)}
                      price={formatTry(PLANS[id].priceTry)}
                      per={`/ ${tp(PER_KEY[id])}`}
                      detail={id === "weekly" ? null : tp("weeklyEquivalent", { amount: formatTry(weeklyEquivalentTry(id)) })}
                      badge={id === "weekly" ? null : tp(`plans.${id}.badge`)}
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
              <div className="sticky bottom-0 space-y-2.5 border-t bg-background/90 px-5 pt-3.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
                <Button asChild size="lg" className="w-full">
                  <Link href={href}>{t("continueWith", { price: formatTry(PLANS[plan].priceTry) })}</Link>
                </Button>
                <p className="text-center text-[11px] leading-relaxed text-muted-foreground">{tp("autoRenewNote")}</p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </PaywallContext.Provider>
  );
}

function PlanOption({
  id,
  selected,
  featured = false,
  featuredLabel,
  name,
  price,
  per,
  detail,
  badge,
}: {
  id: PlanChoice;
  selected: boolean;
  featured?: boolean;
  featuredLabel?: string;
  name: string;
  price: string;
  per?: string;
  detail: string | null;
  badge: string | null;
}) {
  const base = useId();
  const nameId = `${base}-name`;
  const descId = `${base}-desc`;
  // Radyo erişilebilirlik için gerçek (Radix) radyo; görünümü /premium ile aynı onay dairesi (PlanCheck).
  return (
    <label className={cn(planCardClass(selected, featured), "cursor-pointer has-[[role=radio]:focus-visible]:ring-[3px] has-[[role=radio]:focus-visible]:ring-ring/50")}>
      {featured && featuredLabel ? <PlanRibbon>{featuredLabel}</PlanRibbon> : null}
      <RadioGroupItem value={id} aria-labelledby={nameId} aria-describedby={detail || badge ? descId : undefined} className="absolute inset-0 size-full rounded-2xl border-0 opacity-0 shadow-none" />
      <PlanCheck selected={selected} />
      <PlanBody name={name} price={price} per={per} detail={detail} badge={badge} nameId={nameId} descId={descId} />
    </label>
  );
}

export function usePaywall(): Ctx {
  const ctx = useContext(PaywallContext);
  if (!ctx) throw new Error("usePaywall PaywallProvider içinde kullanılmalı");
  return ctx;
}
