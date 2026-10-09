"use client";

import { Flag, ThumbsDown, ThumbsUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { track } from "@/lib/analytics";
import { postJson } from "@/lib/api/client";

type Props = { targetType: "score" | "report" | "tryon" | "exercise"; targetId?: string; section?: string; compact?: boolean };

/** F18: faydalı / faydasız ve "uygunsuz içerik bildir". */
export function FeedbackButtons({ targetType, targetId, section, compact }: Props) {
  const t = useTranslations("feedback");
  const [sent, setSent] = useState<1 | -1 | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function rate(rating: 1 | -1) {
    try {
      await postJson("/api/feedback", { targetType, targetId, rating, reason: section ? `section:${section}` : undefined });
      setSent(rating);
      track("feedback_sent", { targetType, rating });
    } catch {
      toast.error(t("error"));
    }
  }
  async function report() {
    try {
      await postJson("/api/feedback", { targetType, targetId, isAbuseReport: true, reason: `${section ? `section:${section} ` : ""}${reason}`.trim() || undefined });
      setOpen(false);
      toast.success(t("reported"));
      track("feedback_sent", { targetType, rating: null });
    } catch {
      toast.error(t("error"));
    }
  }

  return (
    <div className={compact ? "flex items-center gap-1" : "flex items-center gap-2 pt-1"}>
      <span className="text-xs text-muted-foreground">{sent ? t("thanks") : t("helpful")}</span>
      <Button size="icon-xs" variant={sent === 1 ? "default" : "ghost"} aria-label={t("yes")} onClick={() => rate(1)} disabled={sent !== null}><ThumbsUp /></Button>
      <Button size="icon-xs" variant={sent === -1 ? "default" : "ghost"} aria-label={t("no")} onClick={() => rate(-1)} disabled={sent !== null}><ThumbsDown /></Button>
      <Button size="icon-xs" variant="ghost" aria-label={t("report")} onClick={() => setOpen(true)}><Flag /></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reportTitle")}</DialogTitle>
            <DialogDescription>{t("reportBody")}</DialogDescription>
          </DialogHeader>
          <textarea className="min-h-24 w-full rounded-md border bg-background p-2 text-sm" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reportPlaceholder")} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={report}>{t("send")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
