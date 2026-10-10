"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { deleteProgressPhoto, listProgressPhotos, updateProgressNote, type ProgressPhoto } from "@/lib/local/progressStore";

type Shown = ProgressPhoto & { url: string };

/** /ilerleme (F13): yalnız cihazdaki fotoğraflar; yan yana/kaydırıcı karşılaştırma; silme; sabit not. Ağ isteği yok. */
export function ProgressScreen() {
  const t = useTranslations("progress");
  const [photos, setPhotos] = useState<Shown[] | null>(null);
  const [pick, setPick] = useState<string[]>([]);
  const [slider, setSlider] = useState(50);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let urls: string[] = [];
    listProgressPhotos()
      .then((list) => {
        const shown = list.map((p) => ({ ...p, url: URL.createObjectURL(p.blob) }));
        urls = shown.map((s) => s.url);
        setPhotos(shown);
      })
      .catch(() => setUnavailable(true));
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  async function remove(id: string) {
    await deleteProgressPhoto(id);
    setPhotos((p) => (p ?? []).filter((x) => x.id !== id));
    setPick((p) => p.filter((x) => x !== id));
  }

  async function note(id: string, value: string) {
    try {
      await updateProgressNote(id, value);
      setPhotos((p) => (p ?? []).map((x) => (x.id === id ? { ...x, note: value } : x)));
    } catch {
      toast.error(t("saveError"));
    }
  }

  if (unavailable) return <p className="rounded-md border px-3 py-2 text-sm">{t("storageUnavailable")}</p>;
  if (photos === null) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;

  const a = photos.find((p) => p.id === pick[0]);
  const b = photos.find((p) => p.id === pick[1]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t("deviceNote")}</p>
      {photos.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("emptyTitle")}</CardTitle>
            <CardDescription>{t("emptyBody")}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {a && b ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("compareTitle")}</CardTitle>
            <CardDescription>{new Date(a.takenAt).toLocaleDateString("tr-TR")} → {new Date(b.takenAt).toLocaleDateString("tr-TR")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-xl bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element -- yerel blob */}
              <img src={b.url} alt="" className="absolute inset-0 size-full object-cover" />
              <div className="absolute inset-0 overflow-hidden" style={{ width: `${slider}%` }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- yerel blob */}
                <img src={a.url} alt="" className="size-full max-w-none object-cover" style={{ width: `${10000 / Math.max(slider, 1)}%` }} />
              </div>
              <div className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${slider}%` }} aria-hidden="true" />
            </div>
            <Slider value={[slider]} onValueChange={(v) => setSlider(v[0] ?? 50)} min={0} max={100} aria-label={t("sliderAria")} />
            <Button variant="ghost" size="sm" onClick={() => setPick([])}>{t("clearCompare")}</Button>
          </CardContent>
        </Card>
      ) : photos.length >= 2 ? (
        <p className="text-sm text-muted-foreground">{t("pickTwo", { n: pick.length })}</p>
      ) : null}

      <ul className="grid grid-cols-2 gap-2">
        {photos.map((p) => {
          const selected = pick.includes(p.id);
          return (
            <li key={p.id} className={`overflow-hidden rounded-lg border ${selected ? "ring-2 ring-foreground" : ""}`}>
              <button
                type="button"
                className="block w-full"
                aria-pressed={selected}
                onClick={() => setPick((cur) => (cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur.slice(-1), p.id]))}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- yerel blob */}
                <img src={p.url} alt="" className="aspect-[3/4] w-full object-cover" />
              </button>
              <div className="space-y-1 p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>{new Date(p.takenAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}</span>
                  <Button size="icon-xs" variant="ghost" aria-label={t("delete")} onClick={() => remove(p.id)}><Trash2 /></Button>
                </div>
                <input
                  className="w-full rounded border bg-background px-2 py-1"
                  placeholder={t("notePlaceholder")}
                  defaultValue={p.note ?? ""}
                  maxLength={120}
                  onBlur={(e) => void note(p.id, e.target.value)}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
