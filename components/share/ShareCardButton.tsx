"use client";

import { Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { track } from "@/lib/analytics";
import { APP_NAME, APP_URL } from "@/lib/config/app";
import { renderShareCard, shareOrDownload, type ShareCardFormat } from "@/lib/share/card";

type Props = { overall: number; potential: number; subs: { label: string; value: number }[] };

/** F10: skor + potansiyel + 3 alt skor; fotoğraf eklemek kullanıcı seçimi (varsayılan kapalı), cihazdan seçilir. */
export function ShareCardButton({ overall, potential, subs }: Props) {
  const t = useTranslations("share");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [withPhoto, setWithPhoto] = useState(false);
  const [format, setFormat] = useState<ShareCardFormat>("story");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<ImageBitmap | null>(null);

  async function onFile(file?: File) {
    if (!file) return;
    try {
      photo?.close();
      setPhoto(await createImageBitmap(file, { imageOrientation: "from-image" }));
    } catch {
      toast.error(t("photoError"));
    }
  }

  async function create() {
    setBusy(true);
    try {
      const blob = await renderShareCard({
        overall,
        potential,
        subs,
        appName: APP_NAME,
        url: APP_URL.replace(/^https?:\/\//, ""),
        photo: withPhoto ? photo : null,
        format,
        disclaimer: tc("scoreDisclaimer"),
      });
      track("share_card_created", { withPhoto: withPhoto && !!photo });
      const r = await shareOrDownload(blob, `${APP_NAME.toLowerCase()}-skor.png`, t("shareTitle"));
      toast.success(r === "shared" ? t("shared") : t("downloaded"));
      setOpen(false);
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Share2 aria-hidden="true" /> {t("button")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <Tabs value={format} onValueChange={(v) => setFormat(v as ShareCardFormat)}>
            <TabsList className="w-full">
              <TabsTrigger value="story" className="flex-1">
                {t("story")}
              </TabsTrigger>
              <TabsTrigger value="square" className="flex-1">
                {t("square")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <label htmlFor="share-photo" className="text-sm">
              {t("addPhoto")}
              <span className="block text-xs text-muted-foreground">{t("addPhotoHint")}</span>
            </label>
            <Switch
              id="share-photo"
              checked={withPhoto}
              onCheckedChange={(v) => {
                setWithPhoto(v);
                if (v && !photo) fileRef.current?.click();
              }}
            />
          </div>
          {withPhoto ? (
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              {photo ? t("changePhoto") : t("pickPhoto")}
            </Button>
          ) : null}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          <Button onClick={create} disabled={busy || (withPhoto && !photo)}>
            {t("create")}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
