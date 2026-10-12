"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DELETE_CONFIRM_WORD, DELETION_GRACE_DAYS, isDeleteConfirmed } from "@/lib/account/consents";
import { postJson } from "@/lib/api/client";
import { clearProgressPhotos } from "@/lib/local/progressStore";

/** F15 "Hesabımı sil": "SİL" → POST /api/me/delete → IndexedDB temizle → çıkış (SPEC Faz 13 madde 4). */
export function DeleteAccountDialog() {
  const t = useTranslations("account.delete");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!isDeleteConfirmed(word)) return;
    setBusy(true);
    try {
      await postJson("/api/me/delete", { confirm: word });
      // Cihazdaki ilerleme fotoğrafları (IndexedDB) ve yerel tercihler
      await clearProgressPhotos().catch(() => undefined);
      try {
        localStorage.clear();
      } catch {
        /* özel pencere */
      }
      setOpen(false);
      toast.success(t("done", { days: DELETION_GRACE_DAYS }));
      router.push("/");
      router.refresh();
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description", { days: DELETION_GRACE_DAYS })}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" className="w-full" onClick={() => setOpen(true)}>
          {t("button")}
        </Button>
      </CardContent>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setWord(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmTitle")}</DialogTitle>
            <DialogDescription>{t("confirmBody", { word: DELETE_CONFIRM_WORD, days: DELETION_GRACE_DAYS })}</DialogDescription>
          </DialogHeader>
          <label className="space-y-1 text-sm">
            <span className="block">{t("typeWord", { word: DELETE_CONFIRM_WORD })}</span>
            <Input value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoCapitalize="characters" aria-label={t("typeWord", { word: DELETE_CONFIRM_WORD })} />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("keep")}</Button>
            <Button variant="destructive" disabled={busy || !isDeleteConfirmed(word)} onClick={confirm}>
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
