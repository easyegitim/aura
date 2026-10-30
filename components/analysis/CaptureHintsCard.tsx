"use client";

import { Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { CaptureHint } from "@/lib/score/contract";

/** Bir sonraki çekim için öneriler (UI spec §2.7, C12). Sunucu kilitli cilt ipuçlarını zaten çıkarır; değer taşımaz. */
export function CaptureHintsCard({ hints }: { hints: CaptureHint[] }) {
  const t = useTranslations("analysis.captureHints");
  if (hints.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 font-semibold leading-none">
          <Lightbulb className="size-4" aria-hidden="true" />
          {t("title")}
        </h2>
      </CardHeader>
      <CardContent>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {hints.map((h) => (
            <li key={h}>{t(h)}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
