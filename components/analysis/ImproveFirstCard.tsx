"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { track } from "@/lib/analytics";
import type { PaywallTrigger } from "@/lib/config/paywall";
import type { ImproveItem, LeverKey } from "@/lib/score/contract";
import type { Locked } from "@/lib/score/present";
import { fmtScore } from "@/components/analysis/LockedValue";

/**
 * Plan bölümü (UI spec §7 leverSection ile aynı eşleme). T5'in lib/coach/planBasis.ts#leverSection'ı
 * birleşince bu yerel tablo onunla değiştirilmeli. lv_brow_tidy'nin plan yolu yok (C9: önce-odaklan listesine girmez).
 */
const LEVER_SECTION: Record<LeverKey, "skin" | "hair" | "beard" | null> = {
  lv_blemish_care: "skin",
  lv_texture_smooth: "skin",
  lv_daily_spf: "skin",
  lv_shine_balance: "skin",
  lv_lip_care: "skin",
  lv_hair_styling: "hair",
  lv_haircut_refresh: "hair",
  lv_beard_lineup: "beard",
  lv_brow_tidy: null,
};

/**
 * "Önce odaklanacağın adımlar" (UI spec §2.7). Veri yalnız sunucudan; sıra ve dışlamalar motorda (C9).
 * Kilitliyken her zaman 3 yer tutucu satır: gerçek sayı veya alan sırası kilitli alt skorları ele vermesin.
 */
export function ImproveFirstCard({ v, analysisId, onLocked }: { v: Locked<ImproveItem[] | null>; analysisId: string; onLocked: (t: PaywallTrigger) => void }) {
  const t = useTranslations("analysis");
  if (!v.locked && v.value === null) return null; // eski satır

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 font-semibold leading-none">
          {t("improveFirst.title")}
          {v.locked ? <Lock className="size-4 text-muted-foreground" aria-hidden="true" /> : null}
        </h2>
      </CardHeader>
      <CardContent className="space-y-3">
        {v.locked ? (
          <>
            <ol className="space-y-2 text-sm text-muted-foreground" aria-hidden="true">
              {[1, 2, 3].map((n) => (
                <li key={n} className="flex items-center gap-2">
                  {n}. <span className="tracking-widest">●●●●●●●●</span> <Lock className="size-3.5" />
                </li>
              ))}
            </ol>
            <p className="text-sm text-muted-foreground">{t("improveFirst.lockedBody")}</p>
            <Button variant="outline" className="min-h-11 w-full" onClick={() => onLocked("improve_first")}>
              {t("unlock")}
            </Button>
          </>
        ) : v.value && v.value.length > 0 ? (
          <ol className="space-y-3">
            {v.value.slice(0, 3).map((item, i) => {
              const section = LEVER_SECTION[item.lever];
              return (
                <li key={item.lever} className="space-y-1 rounded-lg border p-3 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="tabular-nums">{i + 1}.</span>
                    {t(`levers.${item.lever}`)}
                    <Badge variant="outline" className="text-[10px]">
                      {t(`sub.${item.sub}`)}
                    </Badge>
                  </p>
                  <p className="text-muted-foreground">{t("improveFirst.gain", { gain: fmtScore(item.gain) })}</p>
                  <Link
                    href={`/plan/${analysisId}${section ? `#section-${section}` : ""}`}
                    className="inline-flex min-h-11 items-center underline underline-offset-4"
                    onClick={() => track("improve_first_clicked", { position: (i + 1) as 1 | 2 | 3 })}
                  >
                    {t("improveFirst.toPlan")}
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">{t("improveFirst.empty")}</p>
        )}
      </CardContent>
    </Card>
  );
}
