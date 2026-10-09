"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { track } from "@/lib/analytics";

type Props = { status: "ok" | "failed" | "pending"; analysisId?: string };

/** /premium/sonuc: başarılı/başarısız; callback gecikmesinde durum birkaç kez sorgulanır (SPEC 4.2). */
export function PaymentResult({ status: initial, analysisId }: Props) {
  const t = useTranslations("checkout.result");
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(`${status}.title`)}</CardTitle>
        <CardDescription>{t(`${status}.body`)}{plan ? ` (${plan})` : ""}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {status === "ok" ? (
          <Button asChild size="lg"><Link href={analysisId ? `/analiz/${analysisId}` : "/analiz"}>{analysisId ? t("ok.cta") : t("ok.ctaList")}</Link></Button>
        ) : status === "failed" ? (
          <Button asChild size="lg"><Link href="/premium">{t("failed.cta")}</Link></Button>
        ) : null}
        <Button asChild variant="ghost"><Link href="/hesap">{t("account")}</Link></Button>
      </CardContent>
    </Card>
  );
}
