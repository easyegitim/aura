import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const SAMPLE = {
  overall: 6.4,
  potential: 7.6,
  subs: [
    { key: "skin", value: 5.9 },
    { key: "hair", value: 6.8 },
    { key: "jawline", value: 6.1 },
  ] as const,
};

const fmt = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Açılıştaki örnek sonuç kartı. Gerçek yüz yok; soyut bir illüstrasyon (SPEC F01). */
export function SampleResultCard() {
  const t = useTranslations("landing.sampleCard");
  return (
    <Card className="mx-auto w-full max-w-sm overflow-hidden" aria-label={t("badge")}>
      <CardContent className="space-y-5 pt-2">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">{t("badge")}</Badge>
          <span className="text-xs text-muted-foreground">{t("illustrationNote")}</span>
        </div>

        <div className="flex items-center gap-5">
          <svg viewBox="0 0 120 120" className="size-24 shrink-0" aria-hidden="true">
            <defs>
              <linearGradient id="aura-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="currentColor" stopOpacity="0.18" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="58" fill="url(#aura-g)" />
            <ellipse cx="60" cy="52" rx="24" ry="30" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path d="M22 112c6-20 20-30 38-30s32 10 38 30" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M36 44c6-14 42-14 48 0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <div>
            <p className="text-sm text-muted-foreground">{t("overallLabel")}</p>
            <p className="text-5xl font-semibold tabular-nums tracking-tight">{fmt(SAMPLE.overall)}</p>
            <p className="mt-1 text-sm">
              {t("potentialLabel")}: <span className="font-medium tabular-nums">{fmt(SAMPLE.potential)}</span>
              <span className="text-muted-foreground"> (+{fmt(SAMPLE.potential - SAMPLE.overall)})</span>
            </p>
          </div>
        </div>

        <ul className="space-y-2.5">
          {SAMPLE.subs.map((s) => (
            <li key={s.key} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{t(`sub.${s.key}`)}</span>
                <span className="tabular-nums text-muted-foreground">{fmt(s.value)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted" role="presentation">
                <div className="h-2 rounded-full bg-foreground/70" style={{ width: `${s.value * 10}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
