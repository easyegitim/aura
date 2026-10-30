"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePaywall } from "@/components/paywall/PaywallSheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlanSkips } from "@/lib/coach/planBasis";

const SECTIONS = ["summary", "hair", "beard", "skin", "exercises", "habits", "style"] as const;

/**
 * Ücretsiz kullanıcıda plan sayfası (UI spec §7): bölüm adları kilitli satırlar olarak görünür, içerik yok.
 * Ankete göre eklenmeyecek bölümler (başörtüsü → saç, çene sağlığı → egzersiz, sakal yok) listelenmez.
 */
export function PlanLocked({ skipped = {} }: { skipped?: PlanSkips }) {
  const t = useTranslations("report");
  const ta = useTranslations("analysis");
  const { open } = usePaywall();
  const visible = SECTIONS.filter((s) => !(s === "hair" && skipped.hair) && !(s === "beard" && skipped.beard) && !(s === "exercises" && skipped.exercises));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("lockedTitle")}</CardTitle>
        <CardDescription>{t("lockedBody")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y rounded-lg border">
          {visible.map((s) => {
            const name = t(`sections.${s}`);
            return (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => open("plan_page")}
                  aria-label={ta("lockedAriaFor", { name })}
                  className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-accent"
                >
                  <span>{name}</span>
                  <Lock aria-hidden="true" className="size-4 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
        <Button type="button" size="lg" className="w-full" onClick={() => open("plan_page")}>
          {ta("unlock")}
        </Button>
      </CardContent>
    </Card>
  );
}
