"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

/**
 * Kilitli bölüm: başlık ve adlandırılmış satırlar görünür (SPEC 5.3), değerler yoktur; "Kilidi aç" paywall açar.
 * preview yalnız kilitliyken gösterilir ve değer taşımaz (ör. "●,●" satırları).
 */
export function LockedSection({
  title,
  description,
  locked,
  onTap,
  preview,
  children,
}: {
  title: string;
  description?: string;
  locked: boolean;
  onTap: () => void;
  preview?: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("analysis");
  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 font-semibold leading-none">
          {title}
          {locked ? <Lock className="size-4 text-muted-foreground" aria-hidden="true" /> : null}
        </h2>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {locked ? (
          <>
            {preview}
            <Button variant="outline" className="min-h-11 w-full" onClick={onTap}>
              {t("unlock")}
            </Button>
          </>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
