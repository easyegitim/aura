"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";

const STEPS = ["landmarks", "ratios", "skinHair", "calibrating"] as const;

/** SPEC 4.1 adım 7: analiz animasyonu; gerçek istek arka planda sürer, son adım yanıta kadar bekler. */
export function AnalysisProgress({ done }: { done: boolean }) {
  const t = useTranslations("analysis.progress");
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= STEPS.length - 1) return;
    const id = setTimeout(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1600);
    return () => clearTimeout(id);
  }, [step]);
  const value = done ? 100 : Math.round(((step + 0.5) / STEPS.length) * 100);
  return (
    <div className="space-y-3 py-10 text-center" role="status" aria-live="polite">
      <p className="text-lg font-medium">{t(`steps.${STEPS[step]}`)}</p>
      <Progress value={value} className="mx-auto max-w-xs" />
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
