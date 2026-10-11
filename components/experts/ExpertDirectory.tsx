"use client";

import { BadgeCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { EXPERT_SPECIALTIES } from "@/content/expert-specialties";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { track } from "@/lib/analytics";
import { ApiClientError, postJson } from "@/lib/api/client";

type Partner = { id: string; name: string; kind: string; specialties: string[]; city: string; institution: string | null; license_no: string; verified_at: string | null };
type Props = { initialSpecialty?: string; lastAnalysisId: string | null; sharingConsent: { has: boolean; version: string } };

/** /uzman (F19): uzmanlık + şehir filtresi, partner kartı (fiyat/kampanya/önce-sonra yok), ön görüşme formu. */
export function ExpertDirectory({ initialSpecialty, lastAnalysisId, sharingConsent }: Props) {
  const t = useTranslations("experts");
  const [specialty, setSpecialty] = useState(initialSpecialty ?? "");
  const [city, setCity] = useState("");
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [selected, setSelected] = useState<Partner | null>(null);
  const [form, setForm] = useState({ name: "", contact: "", message: "" });
  const [share, setShare] = useState(false);
  const [consent, setConsent] = useState(sharingConsent.has);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (specialty) params.set("specialty", specialty);
    if (city.trim()) params.set("city", city.trim());
    let cancelled = false;
    fetch(`/api/experts?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Partner[]) => {
        if (!cancelled) setPartners(d);
      })
      .catch(() => {
        if (!cancelled) setPartners([]);
      });
    return () => {
      cancelled = true;
    };
  }, [specialty, city]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      if (share && lastAnalysisId && !consent) {
        await postJson("/api/consents", { type: "expert_data_sharing", granted: true, textVersion: sharingConsent.version });
        track("consent_updated", { type: "expert_data_sharing", granted: true });
        setConsent(true);
      }
      const res = await postJson<{ requestId: string; refCode: string }>("/api/experts/requests", {
        partnerId: selected.id,
        name: form.name,
        contact: form.contact,
        message: form.message || undefined,
        shareAnalysisId: share && lastAnalysisId ? lastAnalysisId : undefined,
      });
      track("expert_request_sent", { specialty: selected.specialties[0] ?? "" });
      setDone(res?.refCode ?? "");
    } catch (err) {
      const code = err instanceof ApiClientError ? err.code : "NETWORK";
      toast.error(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.GENERIC"));
    } finally {
      setBusy(false);
    }
  }

  const specialtyName = (id: string) => EXPERT_SPECIALTIES.find((s) => s.id === id)?.nameTr ?? id;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">{t("specialty")}</span>
          <select className="h-10 w-full rounded-md border bg-background px-2" value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
            <option value="">{t("all")}</option>
            {EXPERT_SPECIALTIES.map((s) => <option key={s.id} value={s.id}>{s.nameTr}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">{t("city")}</span>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("cityPlaceholder")} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>

      {partners === null ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : partners.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
      <ul className="space-y-2">
        {(partners ?? []).map((p) => (
          <li key={p.id}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {p.name}
                  {p.verified_at ? <Badge variant="secondary"><BadgeCheck className="size-3" aria-hidden="true" /> {t("verified")}</Badge> : null}
                </CardTitle>
                <CardDescription>
                  {p.specialties.map(specialtyName).join(" · ")} · {p.city}{p.institution ? ` · ${p.institution}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">{t("license")}: {p.license_no}</span>
                <Button size="sm" onClick={() => { setSelected(p); setDone(null); }}>{t("request")}</Button>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("formTitle", { name: selected?.name ?? "" })}</DialogTitle>
            <DialogDescription>{t("formBody")}</DialogDescription>
          </DialogHeader>
          {done !== null ? (
            <div className="space-y-3">
              <p className="text-sm">{t("sent", { ref: done })}</p>
              <Button className="w-full" onClick={() => setSelected(null)}>{t("close")}</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <label className="block space-y-1 text-sm"><span className="font-medium">{t("name")}</span><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="block space-y-1 text-sm"><span className="font-medium">{t("contact")}</span><Input required placeholder={t("contactPlaceholder")} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">{t("message")}</span>
                <textarea className="min-h-20 w-full rounded-md border bg-background p-2 text-sm" maxLength={600} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </label>
              {lastAnalysisId ? (
                <label className="flex items-start gap-3 rounded-md border px-3 py-2 text-sm">
                  <Checkbox checked={share} onCheckedChange={(v) => setShare(v === true)} className="mt-0.5" />
                  <span>
                    {t("share")}
                    <span className="block text-xs text-muted-foreground">{t("shareHint")}</span>
                  </span>
                </label>
              ) : null}
              <Button type="submit" className="w-full" disabled={busy}>{t("send")}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
