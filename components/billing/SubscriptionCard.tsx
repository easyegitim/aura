"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { postJson } from "@/lib/api/client";

type Props = { premium: boolean; plan: string | null; periodEnd: string | null; cancelAtPeriodEnd: boolean };

/** /hesap: plan ve tek tık iptal (SPEC 15.2 adım 9). */
export function SubscriptionCard(props: Props) {
  const t = useTranslations("account.subscription");
  const tp = useTranslations("pricing");
  const [cancelAtPeriodEnd, setCancel] = useState(props.cancelAtPeriodEnd);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const end = props.periodEnd ? new Date(props.periodEnd).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : null;

  async function cancel() {
    setBusy(true);
    try {
      await postJson("/api/billing/cancel", {});
      setCancel(true);
      setOpen(false);
      toast.success(t("canceled"));
    } catch {
      toast.error(t("cancelError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          {props.premium && props.plan ? (props.plan === "week_pass" ? t("weekPass") : tp(`plans.${props.plan}.name`)) : t("free")}
          {end ? ` · ${cancelAtPeriodEnd ? t("endsOn", { date: end }) : t("renewsOn", { date: end })}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {props.premium ? (
          cancelAtPeriodEnd ? (
            <p className="text-sm text-muted-foreground">{t("cancelScheduled")}</p>
          ) : (
            <Button variant="outline" onClick={() => setOpen(true)}>{t("cancel")}</Button>
          )
        ) : (
          <Button asChild><Link href="/premium">{t("upgrade")}</Link></Button>
        )}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmTitle")}</DialogTitle>
            <DialogDescription>{t("confirmBody", { date: end ?? "—" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("keep")}</Button>
            <Button variant="destructive" onClick={cancel} disabled={busy}>{t("confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
