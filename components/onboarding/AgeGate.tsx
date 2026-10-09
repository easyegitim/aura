"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card>
        <CardHeader>
          <CardTitle>{t("blockedTitle")}</CardTitle>
          <CardDescription>{t("blockedBody")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/">{t("backHome")}</Link>
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
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{t("label")}</span>
            <select
              name="birthYear"
              required
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              className="h-11 w-full rounded-md border bg-background px-3 text-base"
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
          </label>
          <Button type="submit" className="w-full" size="lg" disabled={!birthYear || busy}>
            {t("continue")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("note")}</p>
        </form>
      </CardContent>
    </Card>
  );
}
