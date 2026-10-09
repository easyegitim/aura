"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { LinkAccount } from "@/components/auth/LinkAccount";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { track } from "@/lib/analytics";
import { ApiClientError, postJson } from "@/lib/api/client";
import { DEFAULT_PLAN_ID, PLANS, SUBSCRIPTION_PLAN_IDS, formatTry, weeklyEquivalentTry, type SubscriptionPlanId } from "@/lib/config/plans";
import { cn } from "@/lib/utils";

type PlanChoice = SubscriptionPlanId | "week_pass";
type Props = { isAnonymous: boolean; initialPlan: PlanChoice; weekPassEnabled: boolean; alreadyPremium: boolean };

/** SPEC 15.2: plan → hesap bağlama (anonimse) → fatura formu + 2 onay → iyzico formu. Kart bilgisi iyzico formunda girilir. */
export function CheckoutFlow({ isAnonymous, initialPlan, weekPassEnabled, alreadyPremium }: Props) {
  const t = useTranslations("checkout");
  const tp = useTranslations("pricing");
  const [plan, setPlan] = useState<PlanChoice>(initialPlan);
  const [linked, setLinked] = useState(!isAnonymous);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", surname: "", gsmNumber: "", identityNumber: "", city: "", address: "" });
  const [terms, setTerms] = useState(false);
  const [waiver, setWaiver] = useState(false);
  const [formHtml, setFormHtml] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // iyzico checkoutFormContent: <script> + <div id="iyzipay-checkout-form">; innerHTML ile gelen script çalışmaz, elle eklenir.
  useEffect(() => {
    const host = formRef.current;
    if (!formHtml || !host) return;
    host.innerHTML = "";
    const tpl = document.createElement("template");
    tpl.innerHTML = formHtml;
    const scripts: HTMLScriptElement[] = [];
    tpl.content.querySelectorAll("script").forEach((s) => {
      scripts.push(s);
      s.remove();
    });
    host.appendChild(tpl.content);
    for (const s of scripts) {
      const el = document.createElement("script");
      if (s.src) el.src = s.src;
      el.textContent = s.textContent;
      host.appendChild(el);
    }
  }, [formHtml]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!terms || !waiver) return;
    setBusy(true);
    try {
      track("checkout_started", { plan });
      const res = await postJson<{ checkoutFormContent: string; token: string }>("/api/billing/checkout", {
        plan,
        buyer: { ...form, identityNumber: form.identityNumber || undefined },
        accepted: { terms: true, waiver: true },
      });
      if (res?.checkoutFormContent) setFormHtml(res.checkoutFormContent);
    } catch (err) {
      const code = err instanceof ApiClientError ? err.code : "NETWORK";
      toast.error(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.GENERIC"));
    } finally {
      setBusy(false);
    }
  }

  if (alreadyPremium) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("alreadyTitle")}</CardTitle>
          <CardDescription>{t("alreadyBody")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full"><Link href="/analiz">{t("goAnalyses")}</Link></Button>
        </CardContent>
      </Card>
    );
  }

  if (formHtml) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("payTitle")}</CardTitle>
          <CardDescription>{t("payBody")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div ref={formRef} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <section aria-labelledby="plan-h" className="space-y-2">
        <h2 id="plan-h" className="text-sm font-medium">{t("choosePlan")}</h2>
        <div className="grid gap-2">
          {SUBSCRIPTION_PLAN_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setPlan(id)}
              aria-pressed={plan === id}
              className={cn("flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm", plan === id ? "border-foreground ring-1 ring-foreground" : "hover:bg-accent")}
            >
              <span>
                <span className="flex items-center gap-2 font-medium">
                  {tp(`plans.${id}.name`)}
                  {id !== "weekly" ? <Badge variant={id === DEFAULT_PLAN_ID ? "default" : "secondary"}>{tp(`plans.${id}.badge`)}</Badge> : null}
                </span>
                <span className="block text-xs text-muted-foreground">{tp("weeklyEquivalent", { amount: formatTry(weeklyEquivalentTry(id)) })}</span>
              </span>
              <span className="font-semibold tabular-nums">{formatTry(PLANS[id].priceTry)}</span>
            </button>
          ))}
          {weekPassEnabled ? (
            <button type="button" onClick={() => setPlan("week_pass")} aria-pressed={plan === "week_pass"} className={cn("flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm", plan === "week_pass" ? "border-foreground ring-1 ring-foreground" : "hover:bg-accent")}>
              <span>
                <span className="block font-medium">{t("weekPass")}</span>
                <span className="block text-xs text-muted-foreground">{t("weekPassHint")}</span>
              </span>
              <span className="font-semibold tabular-nums">{formatTry(PLANS.week_pass.priceTry)}</span>
            </button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{t("bankCardNote")}</p>
      </section>

      {!linked ? (
        <LinkAccount returnPath={`/premium?plan=${plan}`} onLinked={() => setLinked(true)} />
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>{t("billingTitle")}</CardTitle>
              <CardDescription>{t("billingBody")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("fields.name")}><Input required autoComplete="given-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label={t("fields.surname")}><Input required autoComplete="family-name" value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} /></Field>
              </div>
              <Field label={t("fields.phone")}><Input required type="tel" inputMode="tel" autoComplete="tel" placeholder="+905xxxxxxxxx" value={form.gsmNumber} onChange={(e) => setForm({ ...form, gsmNumber: e.target.value })} /></Field>
              <Field label={t("fields.identity")} hint={t("fields.identityHint")}><Input inputMode="numeric" maxLength={11} value={form.identityNumber} onChange={(e) => setForm({ ...form, identityNumber: e.target.value })} /></Field>
              <Field label={t("fields.city")}><Input required autoComplete="address-level2" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
              <Field label={t("fields.address")}><Input required autoComplete="street-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-4">
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" />
                <span>
                  {t.rich("terms", {
                    sale: (c) => <Link href="/yasal/mesafeli-satis" target="_blank" className="underline">{c}</Link>,
                    info: (c) => <Link href="/yasal/on-bilgilendirme" target="_blank" className="underline">{c}</Link>,
                  })}
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={waiver} onCheckedChange={(v) => setWaiver(v === true)} className="mt-0.5" />
                <span>{t("waiver")}</span>
              </label>
              <p className="text-xs text-muted-foreground">{t("renewalNote")}</p>
              <Button type="submit" size="lg" className="w-full" disabled={!terms || !waiver || busy}>
                {t("continue", { amount: formatTry(PLANS[plan].priceTry) })}
              </Button>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}
