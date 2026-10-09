import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SUB_KIND } from "@/lib/config/scoring";
import { SUB_KEYS } from "@/lib/config/teaser";
import type { ClientAnalysis, Locked } from "@/lib/score/present";

const fmt = (n: number | null) => (n === null ? "" : n.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

/** Kilitli değer: gerçek değer istemcide yoktur; "●,●" yer tutucu + kilit (SPEC 5.3). */
function Value({ v, big = false }: { v: Locked<number | null>; big?: boolean }) {
  if (v.locked) {
    return (
      <span className={big ? "text-5xl font-semibold tabular-nums text-muted-foreground/60" : "tabular-nums text-muted-foreground/60"} aria-label="kilitli">
        ●,● <Lock className={big ? "inline size-6" : "inline size-3.5"} aria-hidden="true" />
      </span>
    );
  }
  return <span className={big ? "text-5xl font-semibold tabular-nums" : "tabular-nums"}>{v.value === null ? "–" : fmt(v.value)}</span>;
}

/** Sonuç görünümü (F08 ilk sürüm; Faz 7'de paywall sheet, paylaşım ve 4,0 altı sıralama eklenir). */
export async function ScoreView({ a }: { a: ClientAnalysis }) {
  const t = await getTranslations("analysis");
  const tg = await getTranslations("geometry");
  const anyLocked = a.overall.locked || a.potential.locked || SUB_KEYS.some((k) => a.subscores[k].locked);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("overallTitle")}</CardTitle>
          <CardDescription>
            {tg("faceShape")}: <strong>{a.faceShape ? tg(`shapes.${a.faceShape}`) : "–"}</strong>
            {a.faceShapeDetail?.secondary ? ` (${tg("between", { other: tg(`shapes.${a.faceShapeDetail.secondary}`) })})` : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <Value v={a.overall} big />
          </div>
          <p className="text-sm">
            {t("potential")}: <Value v={a.potential} />
          </p>
          <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("subscoresTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {SUB_KEYS.map((k) => {
              const s = a.subscores[k];
              return (
                <li key={k} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      {t(`sub.${k}`)}
                      <Badge variant="outline" className="text-[10px]">
                        {t(`kind.${SUB_KIND[k]}`)}
                      </Badge>
                    </span>
                    <Value v={s} />
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted" role="presentation">
                    {!s.locked && s.value !== null ? <div className="h-2 rounded-full bg-foreground/70" style={{ width: `${s.value * 10}%` }} /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {anyLocked ? (
        <Card className="border-foreground">
          <CardHeader>
            <CardTitle>{t("locked.title")}</CardTitle>
            <CardDescription>{t("locked.body")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/premium" className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              {t("locked.cta")}
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
