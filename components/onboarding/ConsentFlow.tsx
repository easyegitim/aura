"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState, type UIEvent } from "react";
import { toast } from "sonner";
import { Markdown } from "@/components/legal/Markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { track } from "@/lib/analytics";
import { postJson } from "@/lib/api/client";
import { OPTIONAL_ONBOARDING_CONSENTS, REQUIRED_ANALYSIS_CONSENTS, type ConsentState, type ConsentType } from "@/lib/consent";

type Props = {
  notice: { title: string; version: string; updatedAt: string; body: string };
  consentVersion: string;
  initial: ConsentState;
  noticeAcked: boolean;
  nextPath: string;
};

type Toggles = Record<(typeof REQUIRED_ANALYSIS_CONSENTS)[number] | (typeof OPTIONAL_ONBOARDING_CONSENTS)[number], boolean>;

/** SPEC 4.1 adım 4 / 16.2: aydınlatma (kaydırmalı, "Okudum") → zorunlu üç rıza + pazarlama (isteğe bağlı). */
export function ConsentFlow({ notice, consentVersion, initial, noticeAcked, nextPath }: Props) {
  const t = useTranslations("onboarding.consents");
  const router = useRouter();
  const [step, setStep] = useState<"notice" | "consents">(noticeAcked ? "consents" : "notice");
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [toggles, setToggles] = useState<Toggles>(() => {
    const init = {} as Toggles;
    for (const k of [...REQUIRED_ANALYSIS_CONSENTS, ...OPTIONAL_ONBOARDING_CONSENTS]) {
      const c = initial[k];
      init[k] = Boolean(c?.granted && c.textVersion === consentVersion);
    }
    return init;
  });

  function onScroll(e: UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setScrolledToEnd(true);
  }
  function onBoxMount(el: HTMLDivElement | null) {
    boxRef.current = el;
    if (el && el.scrollHeight <= el.clientHeight + 24) setScrolledToEnd(true);
  }

  async function post(type: ConsentType, granted: boolean, textVersion: string) {
    await postJson("/api/consents", { type, granted, textVersion });
    track("consent_updated", { type, granted });
  }

  async function ackNotice() {
    setBusy(true);
    try {
      await post("kvkk_notice_ack", true, notice.version);
      setStep("consents");
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(false);
    }
  }

  const allRequired = REQUIRED_ANALYSIS_CONSENTS.every((k) => toggles[k]);

  async function saveConsents() {
    setBusy(true);
    try {
      for (const k of [...REQUIRED_ANALYSIS_CONSENTS, ...OPTIONAL_ONBOARDING_CONSENTS]) {
        const prev = initial[k];
        const unchanged = prev && prev.granted === toggles[k] && prev.textVersion === consentVersion;
        if (!unchanged && (toggles[k] || prev)) await post(k, toggles[k], consentVersion);
      }
      router.push(nextPath);
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(false);
    }
  }

  if (step === "notice") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{notice.title}</CardTitle>
          <CardDescription>{t("noticeMeta", { version: notice.version, date: notice.updatedAt })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div ref={onBoxMount} onScroll={onScroll} className="max-h-[50dvh] overflow-y-auto rounded-md border p-3" tabIndex={0}>
            <Markdown>{notice.body}</Markdown>
          </div>
          {!scrolledToEnd ? <p className="text-xs text-muted-foreground">{t("scrollHint")}</p> : null}
          <Button className="w-full" size="lg" disabled={!scrolledToEnd || busy} onClick={ackNotice}>
            {t("read")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ul className="space-y-4">
          {[...REQUIRED_ANALYSIS_CONSENTS, ...OPTIONAL_ONBOARDING_CONSENTS].map((k) => {
            const required = (REQUIRED_ANALYSIS_CONSENTS as readonly string[]).includes(k);
            return (
              <li key={k} className="flex items-start justify-between gap-3">
                <label htmlFor={`consent-${k}`} className="space-y-1">
                  <span className="block text-sm font-medium">
                    {t(`items.${k}.title`)}
                    {required ? <span className="text-muted-foreground"> · {t("required")}</span> : <span className="text-muted-foreground"> · {t("optional")}</span>}
                  </span>
                  <span className="block text-xs text-muted-foreground">{t(`items.${k}.body`)}</span>
                </label>
                <Switch id={`consent-${k}`} checked={toggles[k]} onCheckedChange={(v) => setToggles((s) => ({ ...s, [k]: v }))} />
              </li>
            );
          })}
        </ul>
        {!allRequired ? (
          <p role="status" className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
            {t("missingRequired")}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">{t("revokeNote")}</p>
        <Button className="w-full" size="lg" disabled={!allRequired || busy} onClick={saveConsents}>
          {t("continue")}
        </Button>
      </CardContent>
    </Card>
  );
}
