"use client";

import { useTranslations } from "next-intl";
import { LockedValue, fmtScore } from "@/components/analysis/LockedValue";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import type { PaywallTrigger } from "@/lib/config/paywall";
import type { SubKey } from "@/lib/config/teaser";
import { STRUCTURAL_EXPLAIN_KEYS, type ExplainItem, type ModExplainKey, type NotAssessed, type SubKind } from "@/lib/score/contract";
import type { Locked } from "@/lib/score/present";
import { cn } from "@/lib/utils";

type ModItem = Extract<ExplainItem, { key: ModExplainKey }>;
const isStructuralItem = (i: ExplainItem): i is Extract<ExplainItem, { status: "measured" | "not_measured" }> =>
  (STRUCTURAL_EXPLAIN_KEYS as readonly string[]).includes(i.key);

/** Değiştirilebilir alan çipleri: önce "Geliştirilebilir", sonra "İyi durumda"; "Net görünmedi" yalnız hepsi öyleyse. En fazla 3. */
function modChips(items: readonly ExplainItem[]): ModItem[] {
  const mod = items.filter((i): i is ModItem => !isStructuralItem(i));
  const partial = mod.filter((i) => i.status === "partial");
  const best = mod.filter((i) => i.status === "best");
  const chosen = partial.length + best.length > 0 ? [...partial, ...best] : mod;
  return chosen.slice(0, 3);
}

export type SubRow = {
  k: SubKey;
  v: Locked<number | null>;
  kind: SubKind;
  note: string | null;
  explain: Locked<ExplainItem[] | null>;
  notAssessed?: NotAssessed;
};

function Row({ row, index, reveal, hybrid, onLocked }: { row: SubRow; index: number; reveal: boolean; hybrid: boolean; onLocked: (t: PaywallTrigger) => void }) {
  const t = useTranslations("analysis");
  const { k, v, kind, note, explain } = row;
  // Öncelik: kilit her şeyi geçer (ücretsiz kullanıcıya kilitli alanın değerlendirilmediği söylenmez); sonra "değerlendirilmedi".
  const notAssessed = !v.locked ? row.notAssessed : undefined;
  const items = !explain.locked && explain.value ? explain.value : [];
  const modifiable = kind === "modifiable";
  const chips = modifiable ? modChips(items) : [];

  return (
    <li
      className={cn("space-y-1", reveal && "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-300")}
      style={reveal ? { animationDelay: `${1600 + index * 60}ms` } : undefined}
    >
      <div className="flex min-h-11 items-center justify-between gap-2 text-sm">
        <span className="flex flex-wrap items-center gap-2">
          {t(`sub.${k}`)}
          <Badge variant="outline" className="text-[10px]">
            {t(`kind.${kind}`)}
          </Badge>
        </span>
        {v.locked ? (
          <LockedValue v={v} pop={reveal} onTap={() => onLocked(`sub_${k}`)} aria={t("lockedAriaFor", { name: t(`sub.${k}`) })} />
        ) : notAssessed ? (
          <span className="text-muted-foreground">
            <span aria-hidden="true">– </span>
            {t("notAssessed.value")}
          </span>
        ) : (
          <span className="tabular-nums">{v.value === null ? "–" : fmtScore(v.value)}</span>
        )}
      </div>
      {notAssessed ? null : (
        <div
          className={cn("h-2 w-full rounded-full", v.locked ? "border border-dashed border-muted-foreground" : "bg-muted")}
          role="presentation"
        >
          {!v.locked && v.value !== null ? <div className="h-2 rounded-full bg-foreground/80" style={{ width: `${v.value * 10}%` }} /> : null}
        </div>
      )}
      {hybrid ? <p className="text-xs text-muted-foreground">{t(`subWhat.${k}`)}</p> : null}
      {notAssessed ? (
        <p className="text-xs">{t(`notAssessed.${notAssessed.reason}`)}</p>
      ) : !v.locked ? (
        modifiable ? (
          <>
            {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
            {chips.length ? (
              <div className="flex flex-wrap gap-1.5">
                {chips.map((i) => (
                  <Badge key={i.key} variant="outline">
                    {t("explain.itemStatus", { item: t(`explain.items.${i.key}`), status: t(`explain.status.${i.status}`) })}
                  </Badge>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          // Yapısal alan: cümle ve çip yok; yalnız "bu çekimde ölçülmedi" satırları.
          items
            .filter(isStructuralItem)
            .filter((i) => i.status === "not_measured")
            .map((i) => (
              <p key={i.key} className="text-xs text-muted-foreground">
                {t(`explain.items.${i.key}`)}: {t("explain.status.not_measured")}
              </p>
            ))
        )
      ) : null}
    </li>
  );
}

/** Alt skor listesi (UI spec §2.6). Rozet sunucunun gönderdiği tür (a.kinds) ile; hybrid çene hattı "Yapısal". */
export function SubscoreList({
  rows,
  hybrid,
  reveal,
  onLocked,
}: {
  rows: SubRow[];
  /** Kaynak açıklamaları (subWhat, subsLegend) yalnız hybrid satırlarda doğrudur. */
  hybrid: boolean;
  reveal: boolean;
  onLocked: (t: PaywallTrigger) => void;
}) {
  const t = useTranslations("analysis");
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold leading-none">{t("subscoresTitle")}</h2>
        {hybrid ? <CardDescription>{t("subsLegend")}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {rows.map((row, i) => (
            <Row key={row.k} row={row} index={i} reveal={reveal} hybrid={hybrid} onLocked={onLocked} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
