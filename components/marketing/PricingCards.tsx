import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_PLAN_ID, PLANS, SUBSCRIPTION_PLAN_IDS, formatTry, weeklyEquivalentTry, type SubscriptionPlanId } from "@/lib/config/plans";
import { cn } from "@/lib/utils";
import { StartAnalysisButton } from "./StartAnalysisButton";

const PERIOD_KEY: Record<SubscriptionPlanId, "perWeek" | "perMonth" | "perYear"> = {
  weekly: "perWeek",
  monthly: "perMonth",
  yearly: "perYear",
};

/** Plan kartları; fiyatlar lib/config/plans.ts'ten gelir (SPEC 5.1). */
export function PricingCards({ withCta = false }: { withCta?: boolean }) {
  const t = useTranslations("pricing");
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {SUBSCRIPTION_PLAN_IDS.map((id) => {
        const plan = PLANS[id];
        const highlighted = id === DEFAULT_PLAN_ID;
        const badge = id === "weekly" ? null : t(`plans.${id}.badge`);
        return (
          <Card key={id} className={cn("relative", highlighted && "border-foreground")}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{t(`plans.${id}.name`)}</span>
                {badge ? <Badge variant={highlighted ? "default" : "secondary"}>{badge}</Badge> : null}
              </CardTitle>
              <CardDescription>{t("weeklyEquivalent", { amount: formatTry(weeklyEquivalentTry(id)) })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-3xl font-semibold tabular-nums tracking-tight">
                {formatTry(plan.priceTry)}
                <span className="text-base font-normal text-muted-foreground"> / {t(PERIOD_KEY[id])}</span>
              </p>
              {withCta ? <StartAnalysisButton className="w-full" variant={highlighted ? "default" : "outline"} /> : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
