"use client";

import { CalendarDays, ChevronDown, ShieldX } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { postJson } from "@/lib/api/client";
import { createClient } from "@/lib/db/browser";

type Props = { years: number[]; nextPath: string };

/** SPEC 4.1 adım 3: doğum yılı; 18 altı → engel ekranı, oturum kapanır (sunucuda). */
export function AgeGate({ years, nextPath }: Props) {
  const t = useTranslations("onboarding.age");
  const router = useRouter();
  const [birthYear, setBirthYear] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!birthYear) return;
    setBusy(true);
    try {
      const res = await postJson<{ isAdult: boolean }>("/api/onboarding/age", { birthYear: Number(birthYear) });
      if (!res?.isAdult) {
        track("age_blocked");
        try {
          await createClient().auth.signOut();
        } catch {
          // sunucu zaten oturumu kapattı
        }
        setBlocked(true);
        return;
      }
      router.push(nextPath);
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(false);
    }
  }

  if (blocked) {
    return (
      <div className="space-y-6 rounded-2xl border bg-card bg-hero-glow p-6 text-center shadow-card">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand" aria-hidden="true">
          <ShieldX className="size-6" />
        </span>
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight">{t("blockedTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("blockedBody")}</p>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href="/">{t("backHome")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand" aria-hidden="true">
          <CalendarDays className="size-6" />
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-semibold">{t("label")}</span>
        <span className="relative block">
          <select
            name="birthYear"
            required
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            className="num h-14 w-full appearance-none rounded-xl border border-input bg-card px-4 pr-10 text-lg font-semibold shadow-card focus-visible:border-brand"
          >
            <option value="" disabled>
              {t("placeholder")}
            </option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        </span>
      </label>
      <Button type="submit" className="w-full" size="lg" disabled={!birthYear || busy}>
        {t("continue")}
      </Button>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{t("note")}</p>
    </form>
  );
}
