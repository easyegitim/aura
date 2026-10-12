"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { postJson } from "@/lib/api/client";

type Props = { requestedAt: string; purgeAt: string };

/** /silme: 7 gün içinde "Silme talebini iptal et" (SPEC Faz 13 madde 4). */
export function CancelDeletionCard({ requestedAt, purgeAt }: Props) {
  const t = useTranslations("deletion");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  async function cancel() {
    setBusy(true);
    try {
      await postJson("/api/me/delete/cancel", {});
      toast.success(t("canceled"));
      router.push("/hesap");
      router.refresh();
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("body", { requested: fmt(requestedAt), purge: fmt(purgeAt) })}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Button size="lg" disabled={busy} onClick={cancel}>{t("cancelButton")}</Button>
        <p className="text-xs text-muted-foreground">{t("keepHint")}</p>
        <SignOutButton />
      </CardContent>
    </Card>
  );
}
