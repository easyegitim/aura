"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EXERCISES, EXERCISE_SAFETY_TEXT } from "@/content/exercises";
import { HABITS } from "@/content/habits";
import { SKIN_STEPS } from "@/content/skin-steps";
import { ExerciseTimer } from "@/components/routine/ExerciseTimer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/db/browser";
import { completionRatio, computeStreak, istanbulDate, type DayLog } from "@/lib/routine/streak";

type Item = { id: string; kind: "step" | "exercise" | "habit"; ref_id: string | null; slot: "morning" | "evening" | "daily" | "weekly"; title: string; position: number };
const SLOTS = ["morning", "daily", "evening", "weekly"] as const;

/** /rutin (F12): bugünün listesi, routine_logs upsert (iyimser), seri, zamanlayıcılar, düzenleme. RLS: kendi satırları. */
export function RoutineScreen({ userId, exerciseEligible }: { userId: string; exerciseEligible: boolean }) {
  const t = useTranslations("routine");
  const today = istanbulDate();
  const [items, setItems] = useState<Item[] | null>(null);
  const [logs, setLogs] = useState<DayLog[]>([]);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const [i, l] = await Promise.all([
      supabase.from("routine_items").select("id, kind, ref_id, slot, title, position").eq("active", true).order("position"),
      supabase.from("routine_logs").select("log_date, item_id, done").gte("log_date", since),
    ]);
    setItems((i.data ?? []) as Item[]);
    setLogs((l.data ?? []) as DayLog[]);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const dailyIds = useMemo(() => (items ?? []).filter((i) => i.slot !== "weekly").map((i) => i.id), [items]);
  const streak = useMemo(() => computeStreak(logs, dailyIds.length, today), [logs, dailyIds.length, today]);
  const ratio = useMemo(() => completionRatio(logs, dailyIds, today), [logs, dailyIds, today]);
  const doneToday = (id: string) => logs.some((l) => l.log_date === today && l.item_id === id && l.done);

  async function toggle(item: Item) {
    const next = !doneToday(item.id);
    // iyimser güncelleme
    setLogs((prev) => [...prev.filter((l) => !(l.log_date === today && l.item_id === item.id)), { log_date: today, item_id: item.id, done: next }]);
    const { error } = await createClient().from("routine_logs").upsert({ user_id: userId, item_id: item.id, log_date: today, done: next }, { onConflict: "user_id,item_id,log_date" });
    if (error) {
      toast.error(t("saveError"));
      void load();
      return;
    }
    if (next) track("routine_checked", { kind: item.kind });
  }

  async function remove(item: Item) {
    setItems((prev) => (prev ?? []).filter((i) => i.id !== item.id));
    await createClient().from("routine_items").update({ active: false }).eq("id", item.id);
  }

  async function move(item: Item, dir: -1 | 1) {
    if (!items) return;
    const idx = items.findIndex((i) => i.id === item.id);
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    const renumbered = next.map((i, k) => ({ ...i, position: k }));
    setItems(renumbered);
    const supabase = createClient();
    await Promise.all(renumbered.map((i) => supabase.from("routine_items").update({ position: i.position }).eq("id", i.id)));
  }

  async function add(kind: Item["kind"], refId: string, slot: Item["slot"], title: string) {
    const position = items?.length ?? 0;
    const { data, error } = await createClient().from("routine_items").insert({ user_id: userId, kind, ref_id: refId, slot, title, position }).select("id, kind, ref_id, slot, title, position").single();
    if (error || !data) {
      toast.error(t("saveError"));
      return;
    }
    setItems((prev) => [...(prev ?? []), data as Item]);
    setAdding(false);
  }

  if (items === null) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;

  if (items.length === 0 && !adding) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("emptyTitle")}</CardTitle>
          <CardDescription>{t("emptyBody")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Button asChild><Link href="/plan">{t("fromPlan")}</Link></Button>
          <Button variant="outline" onClick={() => setAdding(true)}><Plus aria-hidden="true" /> {t("addManual")}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-2 pt-4">
          <div className="flex items-center justify-between text-sm">
            <span>{t("today", { date: new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long" }) })}</span>
            <span className="font-medium">{t("streak", { n: streak })}</span>
          </div>
          <Progress value={Math.round(ratio * 100)} aria-label={t("progressAria")} />
          <p className="text-xs text-muted-foreground">{t("streakHint")}</p>
        </CardContent>
      </Card>

      {SLOTS.map((slot) => {
        const list = items.filter((i) => i.slot === slot);
        if (!list.length) return null;
        return (
          <Card key={slot}>
            <CardHeader>
              <CardTitle className="text-base">{t(`slots.${slot}`)}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {list.map((item) => {
                  const ex = item.kind === "exercise" ? EXERCISES.find((e) => e.id === item.ref_id) : undefined;
                  const done = doneToday(item.id);
                  return (
                    <li key={item.id} className="rounded-md border p-3">
                      <div className="flex items-start gap-3">
                        <Checkbox id={`ri-${item.id}`} checked={done} onCheckedChange={() => toggle(item)} className="mt-0.5" />
                        <label htmlFor={`ri-${item.id}`} className={`flex-1 text-sm ${done ? "text-muted-foreground line-through" : ""}`}>
                          {item.title}
                          {ex ? <span className="block text-xs text-muted-foreground no-underline">{ex.doseTr}</span> : null}
                        </label>
                        {editing ? (
                          <span className="flex gap-1">
                            <Button size="icon-xs" variant="ghost" aria-label={t("moveUp")} onClick={() => move(item, -1)}><ArrowUp /></Button>
                            <Button size="icon-xs" variant="ghost" aria-label={t("moveDown")} onClick={() => move(item, 1)}><ArrowDown /></Button>
                            <Button size="icon-xs" variant="ghost" aria-label={t("remove")} onClick={() => remove(item)}><Trash2 /></Button>
                          </span>
                        ) : null}
                      </div>
                      {ex && !done ? (
                        <div className="mt-2 space-y-1 pl-7">
                          <ExerciseTimer exercise={ex} onComplete={() => void toggle(item)} />
                          <p className="text-[11px] text-muted-foreground">{EXERCISE_SAFETY_TEXT}</p>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setEditing((e) => !e)}>{editing ? t("done") : t("edit")}</Button>
        <Button variant="outline" className="flex-1" onClick={() => setAdding(true)}><Plus aria-hidden="true" /> {t("addManual")}</Button>
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("addTitle")}</DialogTitle></DialogHeader>
          <AddList title={t("slots.morning")} entries={SKIN_STEPS.filter((s) => s.slot === "morning").map((s) => ({ key: s.id, label: s.nameTr, onAdd: () => add("step", s.id, "morning", s.nameTr) }))} />
          <AddList title={t("slots.evening")} entries={SKIN_STEPS.filter((s) => s.slot === "evening").map((s) => ({ key: s.id, label: s.nameTr, onAdd: () => add("step", s.id, "evening", s.nameTr) }))} />
          <AddList title={t("slots.weekly")} entries={SKIN_STEPS.filter((s) => s.slot === "weekly").map((s) => ({ key: s.id, label: s.nameTr, onAdd: () => add("step", s.id, "weekly", s.nameTr) }))} />
          <AddList title={t("habits")} entries={HABITS.map((h) => ({ key: h.id, label: `${h.nameTr}: ${h.defaultTargetTr}`, onAdd: () => add("habit", h.id, h.slot, `${h.nameTr}: ${h.defaultTargetTr}`) }))} />
          {exerciseEligible ? (
            <AddList title={t("exercises")} entries={EXERCISES.map((e) => ({ key: e.id, label: `${e.nameTr} (${e.doseTr})`, onAdd: () => add("exercise", e.id, e.slot, e.nameTr) }))} />
          ) : (
            <p className="text-xs text-muted-foreground">{t("exercisesNotEligible")}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddList({ title, entries }: { title: string; entries: { key: string; label: string; onAdd: () => void }[] }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-medium">{title}</h3>
      <ul className="space-y-1">
        {entries.map((e) => (
          <li key={e.key}>
            <button type="button" onClick={e.onAdd} className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-accent">{e.label}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
