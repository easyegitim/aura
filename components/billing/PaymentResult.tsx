"use client";

import { ArrowRight, BadgeCheck, CircleAlert, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

type Props = { status: "ok" | "failed" | "pending"; analysisId?: string };

/** /premium/sonuc: başarılı/başarısız; callback gecikmesinde durum birkaç kez sorgulanır (SPEC 4.2). */
export function PaymentResult({ status: initial, analysisId }: Props) {
  const t = useTranslations("checkout.result");
  const tc = useTranslations("checkout");
  const tp = useTranslations("pricing");
  const [status, setStatus] = useState(initial);
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "pending") {
      if (status === "ok") fetch("/api/billing/status").then((r) => r.json()).then((s: { plan?: string | null }) => {
        setPlan(s.plan ?? null);
        if (s.plan) track("subscription_activated", { plan: s.plan });
      }).catch(() => undefined);
      return;
    }
    let tries = 0;
    const id = setInterval(async () => {
      tries++;
      try {
        const s = (await (await fetch("/api/billing/status")).json()) as { premium: boolean; plan: string | null };
        if (s.premium) {
          setPlan(s.plan);
          setStatus("ok");
          if (s.plan) track("subscription_activated", { plan: s.plan });
          clearInterval(id);
        }
      } catch {
        // tekrar dene
      }
      if (tries >= 10) {
        clearInterval(id);
        setStatus("failed");
      }
    }, 3000);
    return () => clearInterval(id);
  }, [status]);

  const planName = plan === "weekly" || plan === "monthly" || plan === "yearly" ? tp(`plans.${plan}.name`) : plan === "week_pass" ? tc("weekPass") : null;
  const Icon = status === "ok" ? BadgeCheck : status === "failed" ? CircleAlert : Loader2;
  return (
    <Card className="bg-hero-glow">
      <CardContent className="flex flex-col items-center gap-3 pt-4 text-center">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-16 place-items-center rounded-full",
            status === "ok" && "bg-cta-gradient text-primary-foreground shadow-glow",
            status === "failed" && "bg-destructive/12 text-destructive",
            status === "pending" && "bg-brand-soft text-brand",
          )}
        >
          <Icon className={cn("size-8", status === "pending" && "motion-safe:animate-spin")} />
        </span>
        <div role="status" aria-live="polite" className="space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight">{t(`${status}.title`)}</h1>
          <p className="text-[13px] text-muted-foreground">
            {t(`${status}.body`)}
            {planName ? ` (${planName})` : ""}
          </p>
        </div>
        <div className="mt-2 grid w-full gap-2">
          {status === "ok" ? (
            <Button asChild size="lg">
              <Link href={analysisId ? `/analiz/${analysisId}` : "/analiz"}>
                {analysisId ? t("ok.cta") : t("ok.ctaList")}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : status === "failed" ? (
            <Button asChild size="lg"><Link href={analysisId ? `/premium?analysis=${analysisId}` : "/premium"}>{t("failed.cta")}</Link></Button>
          ) : null}
          <Button asChild variant="ghost"><Link href="/hesap">{t("account")}</Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}
