"use client";

import { Scissors } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EXERCISES, EXERCISE_SAFETY_TEXT } from "@/content/exercises";
import { HABITS } from "@/content/habits";
import { getPreset } from "@/content/presets";
import { SKIN_STEPS } from "@/content/skin-steps";
import { FeedbackButtons } from "@/components/report/FeedbackButtons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { track } from "@/lib/analytics";
import type { CoachReport, ReportPick } from "@/lib/ai/reportSchema";
import { ApiClientError, postJson } from "@/lib/api/client";
import { addReportToRoutine } from "@/lib/routine/addFromReport";

type Props = { analysisId: string; initial: { reportId: string; report: CoachReport; isFallback: boolean } | null; expertNetworkEnabled: boolean };

/** /plan/[analysisId] (F09). Rapor yoksa ilk açılışta üretilir (SPEC 9.1). */
export function ReportView({ analysisId, initial, expertNetworkEnabled }: Props) {
  const t = useTranslations("report");
  const tc = useTranslations("common");
  const [state, setState] = useState<{ reportId: string; report: CoachReport; isFallback: boolean } | null>(initial);
  const [status, setStatus] = useState<"idle" | "generating" | "error">(initial ? "idle" : "generating");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate(regenerate = false) {
    setStatus("generating");
    setErrorCode(null);
    try {
      const r = await postJson<{ reportId: string; report: CoachReport; isFallback: boolean }>("/api/reports", { analysisId, regenerate });
      if (!r) throw new Error("empty");
      setState(r);
      setStatus("idle");
      track("report_viewed");
    } catch (e) {
      setErrorCode(e instanceof ApiClientError ? e.code : "NETWORK");
      setStatus("error");
    }
  }

  useEffect(() => {
    // Yalnız ilk açılış: rapor yoksa üret (asenkron; efekt gövdesinde senkron setState yok).
    if (!initial) void Promise.resolve().then(() => generate());
    else track("report_viewed");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnız ilk açılış
  }, []);

  async function addToRoutine() {
    if (!state) return;
    setBusy(true);
    try {
      const n = await addReportToRoutine(state.report, state.report.exercises.length > 0);
      toast.success(n > 0 ? t("addedToRoutine", { n }) : t("alreadyInRoutine"));
    } catch {
      toast.error(t("routineError"));
    } finally {
      setBusy(false);
    }
  }

  if (status === "generating") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("generatingTitle")}</CardTitle>
          <CardDescription>{t("generatingBody")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (status === "error" || !state) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("errorTitle")}</CardTitle>
          <CardDescription>{errorCode && t.has(`errors.${errorCode}`) ? t(`errors.${errorCode}`) : t("errors.GENERIC")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {errorCode === "PREMIUM_REQUIRED" ? <Button asChild><Link href="/premium">{t("goPremium")}</Link></Button> : <Button onClick={() => generate()}>{t("retry")}</Button>}
        </CardContent>
      </Card>
    );
  }

  const r = state.report;
  return (
    <div className="space-y-4">
      {state.isFallback ? <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">{t("fallbackNote")}</p> : null}

      <Section id="summary" title={t("sections.summary")} reportId={state.reportId}>
        <p className="text-sm">{r.summary}</p>
        <p className="text-sm text-muted-foreground">{r.scoreNarrative}</p>
      </Section>

      {r.hair.length ? (
        <Section id="hair" title={t("sections.hair")} reportId={state.reportId}>
          {r.hair.map((p) => <PickCard key={p.presetId} pick={p} />)}
        </Section>
      ) : null}
      {r.beard.length ? (
        <Section id="beard" title={t("sections.beard")} reportId={state.reportId}>
          {r.beard.map((p) => <PickCard key={p.presetId} pick={p} />)}
        </Section>
      ) : null}
      {r.hairColor ? (
        <Section id="color" title={t("sections.color")} reportId={state.reportId}>
          <PickCard pick={r.hairColor} />
        </Section>
      ) : null}

      <Section id="skin" title={t("sections.skin")} reportId={state.reportId}>
        {(["morning", "evening", "weekly"] as const).map((slot) =>
          r.skincare[slot].length ? (
            <div key={slot}>
              <h3 className="text-sm font-medium">{t(`slots.${slot}`)}</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {r.skincare[slot].map((s, i) => {
                  const def = SKIN_STEPS.find((x) => x.id === s.stepType);
                  return <li key={`${s.stepType}-${i}`}><span className="font-medium">{def?.nameTr ?? s.stepType}</span> <span className="text-muted-foreground">— {s.note}</span></li>;
                })}
              </ul>
            </div>
          ) : null,
        )}
      </Section>

      {r.faceContours.enabled && r.faceContours.tips.length ? (
        <Section id="contours" title={t("sections.contours")} reportId={state.reportId}>
          <ul className="list-disc space-y-1 pl-5 text-sm">{r.faceContours.tips.map((tip, i) => <li key={i}>{tip}</li>)}</ul>
        </Section>
      ) : null}

      {r.exercises.length ? (
        <Section id="exercises" title={t("sections.exercises")} reportId={state.reportId}>
          <ul className="space-y-2 text-sm">
            {r.exercises.map((e) => {
              const def = EXERCISES.find((x) => x.id === e.id);
              return (
                <li key={e.id} className="rounded-md border p-3">
                  <p className="font-medium">{def?.nameTr ?? e.id} <Badge variant="outline">{def?.doseTr}</Badge></p>
                  <p className="text-muted-foreground">{e.why}</p>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">{EXERCISE_SAFETY_TEXT}</p>
        </Section>
      ) : null}

      {r.habits.length ? (
        <Section id="habits" title={t("sections.habits")} reportId={state.reportId}>
          <ul className="space-y-1 text-sm">
            {r.habits.map((h) => <li key={h.id}><span className="font-medium">{HABITS.find((x) => x.id === h.id)?.nameTr ?? h.id}</span> <span className="text-muted-foreground">— {h.target}</span></li>)}
          </ul>
        </Section>
      ) : null}

      {r.style.length ? (
        <Section id="style" title={t("sections.style")} reportId={state.reportId}>
          <ul className="list-disc space-y-1 pl-5 text-sm">{r.style.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </Section>
      ) : null}

      {r.seeProfessional ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>{t("sections.professional")}</CardTitle>
            <CardDescription>{r.seeProfessional.text}</CardDescription>
          </CardHeader>
          {expertNetworkEnabled ? (
            <CardContent>
              <Button asChild variant="outline"><Link href={`/uzman?alan=${encodeURIComponent(r.seeProfessional.specialty)}`}>{t("findExpert")}</Link></Button>
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      <div className="grid gap-2">
        <Button size="lg" onClick={addToRoutine} disabled={busy}>{t("addToRoutine")}</Button>
        <Button variant="ghost" onClick={() => generate(true)} disabled={busy}>{t("regenerate")}</Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">{tc("notMedicalAdvice")}</p>
    </div>
  );
}

function Section({ id, title, reportId, children }: { id: string; title: string; reportId: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
        <FeedbackButtons targetType="report" targetId={reportId} section={id} compact />
      </CardContent>
    </Card>
  );
}

function PickCard({ pick }: { pick: ReportPick }) {
  const t = useTranslations("report");
  const preset = getPreset(pick.presetId);
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border p-3 text-sm">
      <p className="font-medium">{preset?.nameTr ?? pick.presetId}</p>
      <p className="text-muted-foreground">{pick.why}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t("maintenance")}: {pick.maintenance}</p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>{t("showBarber")}</Button>
        <Button size="sm" variant="outline" asChild><Link href={`/dene?preset=${pick.presetId}`}><Scissors aria-hidden="true" /> {t("tryIt")}</Link></Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{preset?.nameTr ?? pick.presetId}</DialogTitle>
            <DialogDescription>{t("barberHint")}</DialogDescription>
          </DialogHeader>
          <p className="rounded-md bg-muted p-4 text-lg leading-relaxed">{pick.barberScript}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
