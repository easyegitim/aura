"use client";

import { ArrowUpRight, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";
import { usePaywall } from "@/components/paywall/PaywallSheet";
import { ShareCardButton } from "@/components/share/ShareCardButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SUB_KIND } from "@/lib/config/scoring";
import { SUB_KEYS, type SubKey } from "@/lib/config/teaser";
import type { ClientAnalysis, Locked } from "@/lib/score/present";

const fmt = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** SPEC 8.7: bu skorun altında ekran potansiyel ve plana odaklanır. */
const FOCUS_BELOW = 4.0;

type Observations = { skin?: string; hair?: string; brows?: string; facialHair?: string };

/** Sonuç ekranı (F08). Kilitli değerler istemcide yoktur; dokununca paywall sheet açılır. */
export function ScoreView({ a, premium }: { a: ClientAnalysis; premium: boolean }) {
  const t = useTranslations("analysis");
  const tg = useTranslations("geometry");
  const { open } = usePaywall();
  const lockedTap = (trigger: string) => () => open(trigger);

  const overall = a.overall.locked ? null : a.overall.value;
  const potential = a.potential.locked ? null : a.potential.value;
  const obs = (a.observations.locked ? null : (a.observations.value as Observations | null)) ?? null;
  const metrics = a.metrics.locked ? null : a.metrics.value;
  const lowScore = overall !== null && overall < FOCUS_BELOW;

  const overallCard = (
    <Card>
      <CardHeader>
        <CardTitle>{t("overallTitle")}</CardTitle>
        <CardDescription>
          {tg("faceShape")}: <strong>{a.faceShape ? tg(`shapes.${a.faceShape}`) : "–"}</strong>
          {a.faceShapeDetail?.secondary ? ` (${tg("between", { other: tg(`shapes.${a.faceShapeDetail.secondary}`) })})` : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div><LockedValue v={a.overall} big onTap={lockedTap("overall")} aria={t("lockedAria")} /></div>
        <p className="flex items-center gap-1 text-sm">
          {t("potentialTitle")}: <LockedValue v={a.potential} onTap={lockedTap("potential")} aria={t("lockedAria")} />
          {overall !== null && potential !== null && potential > overall ? (
            <span className="inline-flex items-center text-muted-foreground"><ArrowUpRight className="size-4" aria-hidden="true" />+{fmt(potential - overall)}</span>
          ) : null}
        </p>
        {overall !== null ? <p className="text-sm text-muted-foreground">{t("narrative", { overall: fmt(overall), potential: potential !== null ? fmt(potential) : "–" })}</p> : null}
        <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
      </CardContent>
    </Card>
  );

  const subsCard = (
    <Card>
      <CardHeader><CardTitle>{t("subscoresTitle")}</CardTitle></CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {orderSubs(a, lowScore).map((k) => {
            const s = a.subscores[k];
            const note = obs ? observationFor(k, obs) : null;
            return (
              <li key={k} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    {t(`sub.${k}`)}
                    <Badge variant="outline" className="text-[10px]">{t(`kind.${SUB_KIND[k]}`)}</Badge>
                  </span>
                  <LockedValue v={s} onTap={lockedTap(`sub_${k}`)} aria={t("lockedAria")} />
                </div>
                <div className="h-2 w-full rounded-full bg-muted" role="presentation">
                  {!s.locked && s.value !== null ? <div className="h-2 rounded-full bg-foreground/70" style={{ width: `${s.value * 10}%` }} /> : null}
                </div>
                {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );

  const ratiosCard = (
    <LockedSection title={t("ratiosTitle")} locked={!metrics} onTap={lockedTap("ratios")}>
      {metrics ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{tg("canthalTilt")}</dt>
          <dd>{metrics.canthalTiltDeg > 2 ? tg("tilt.positive") : metrics.canthalTiltDeg < -2 ? tg("tilt.negative") : tg("tilt.neutral")}</dd>
          <dt className="text-muted-foreground">{tg("thirds")}</dt>
          <dd className="tabular-nums">{pct(metrics.thirds.upper)} / {pct(metrics.thirds.middle)} / {pct(metrics.thirds.lower)}</dd>
          <dt className="text-muted-foreground">{tg("fwhr")}</dt>
          <dd className="tabular-nums">{metrics.fwhr.toFixed(2)}</dd>
          <dt className="text-muted-foreground">{tg("jawRatio")}</dt>
          <dd className="tabular-nums">{metrics.jawRatio.toFixed(2)}</dd>
        </dl>
      ) : null}
      {metrics ? <p className="mt-2 text-xs text-muted-foreground">{tg("note")}</p> : null}
    </LockedSection>
  );

  const planCard = (
    <LockedSection title={t("planTitle")} description={t("planBody")} locked={!premium} onTap={lockedTap("plan")}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button asChild><Link href={`/plan/${a.id}`}>{t("seePlan")}</Link></Button>
        <Button asChild variant="outline"><Link href="/dene">{t("tryStyles")}</Link></Button>
      </div>
    </LockedSection>
  );

  const shareCard =
    premium && overall !== null && potential !== null ? (
      <ShareCardButton
        overall={overall}
        potential={potential}
        subs={(["skin", "hair", "jawline"] as SubKey[]).map((k) => ({ label: t(`sub.${k}`), value: (a.subscores[k].locked ? null : a.subscores[k].value) ?? 0 }))}
      />
    ) : null;

  return (
    <div className="space-y-4">
      {lowScore ? (
        <>
          {planCard}
          {subsCard}
          {overallCard}
        </>
      ) : (
        <>
          {overallCard}
          {subsCard}
          {ratiosCard}
          {planCard}
        </>
      )}
      {lowScore ? ratiosCard : null}
      {shareCard}
    </div>
  );
}

/** Kilitli değer: gerçek değer istemcide yoktur; "●,●" + kilit, dokununca paywall (SPEC 5.3). */
function LockedValue({ v, big = false, onTap, aria }: { v: Locked<number | null>; big?: boolean; onTap: () => void; aria: string }) {
  if (v.locked) {
    return (
      <button type="button" onClick={onTap} aria-label={aria} className={big ? "text-5xl font-semibold tabular-nums text-muted-foreground/60" : "tabular-nums text-muted-foreground/60"}>
        ●,● <Lock className={big ? "inline size-6" : "inline size-3.5"} aria-hidden="true" />
      </button>
    );
  }
  return <span className={big ? "text-5xl font-semibold tabular-nums" : "tabular-nums"}>{v.value === null ? "–" : fmt(v.value)}</span>;
}

/** Kilitli bölüm: başlık görünür (SPEC 5.3), içerik kilitli ise dokununca paywall. */
function LockedSection({ title, description, locked, onTap, children }: { title: string; description?: string; locked: boolean; onTap: () => void; children: ReactNode }) {
  const t = useTranslations("analysis");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          {locked ? <Lock className="size-4 text-muted-foreground" aria-hidden="true" /> : null}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {locked ? (
          <Button variant="outline" className="w-full" onClick={onTap}>
            {t("unlock")}
          </Button>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

/** Skor 4,0 altındaysa geliştirilebilir alanlar önce (SPEC 8.7). */
function orderSubs(a: ClientAnalysis, lowScore: boolean): SubKey[] {
  if (!lowScore) return [...SUB_KEYS];
  const rank = { modifiable: 0, partial: 1, structural: 2 } as const;
  return [...SUB_KEYS].sort((x, y) => {
    const d = rank[SUB_KIND[x]] - rank[SUB_KIND[y]];
    if (d !== 0) return d;
    const vx = a.subscores[x].locked ? 99 : (a.subscores[x].value ?? 99);
    const vy = a.subscores[y].locked ? 99 : (a.subscores[y].value ?? 99);
    return vx - vy;
  });
}

function observationFor(k: SubKey, o: Observations): string | null {
  if (k === "skin") return o.skin ?? null;
  if (k === "hair") return o.hair ?? null;
  if (k === "grooming") return [o.brows, o.facialHair].filter(Boolean).join(" ") || null;
  return null;
}

const pct = (v: number | null) => (v === null ? "–" : `%${Math.round(v * 100)}`);
