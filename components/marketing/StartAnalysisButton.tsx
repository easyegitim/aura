"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ComponentProps } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/db/browser";

/** Oturum açıldıktan sonra gidilecek ilk ekran (SPEC 4.1 adım 3). */
export const ONBOARDING_START_PATH = "/baslangic/yas";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type Props = Omit<ComponentProps<typeof Button>, "onClick" | "children"> & { label?: string };

/**
 * "Analizini başlat": mevcut oturum varsa doğrudan ilerler; yoksa Turnstile doğrulaması ile
 * anonim Supabase oturumu açar (SPEC 2 D17, 6.2). Site anahtarı tanımlı değilse (yerel geliştirme,
 * Supabase'de captcha kapalı) doğrulama adımı atlanır.
 */
export function StartAnalysisButton({ label, ...buttonProps }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [navigating, startNavigation] = useTransition();

  function goToOnboarding() {
    setCaptchaOpen(false);
    startNavigation(() => router.push(ONBOARDING_START_PATH));
  }

  async function signInAnonymously(captchaToken?: string) {
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInAnonymously(
        captchaToken ? { options: { captchaToken } } : undefined,
      );
      if (error) {
        toast.error(t("auth.sessionError"));
        setCaptchaOpen(false);
        return;
      }
      track("anon_session_started");
      goToOnboarding();
    } finally {
      setBusy(false);
    }
  }

  async function handleClick() {
    track("landing_cta_clicked");
    let hasSession = false;
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      hasSession = Boolean(data.session);
    } catch {
      toast.error(t("auth.configError"));
      return;
    }
    if (hasSession) {
      goToOnboarding();
      return;
    }
    if (!TURNSTILE_SITE_KEY) {
      await signInAnonymously();
      return;
    }
    setCaptchaOpen(true);
  }

  return (
    <>
      <Button {...buttonProps} onClick={handleClick} disabled={busy || navigating || buttonProps.disabled}>
        {label ?? t("common.startAnalysis")}
      </Button>
      <Dialog open={captchaOpen} onOpenChange={setCaptchaOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("auth.captchaTitle")}</DialogTitle>
            <DialogDescription>{t("auth.captchaDescription")}</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-16 items-center justify-center">
            {TURNSTILE_SITE_KEY && captchaOpen ? (
              <Turnstile
                siteKey={TURNSTILE_SITE_KEY}
                options={{ language: "tr", theme: "auto", size: "flexible" }}
                onSuccess={(token) => void signInAnonymously(token)}
                onError={() => toast.error(t("auth.captchaError"))}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
