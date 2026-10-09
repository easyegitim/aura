"use client";

// SPEC 11.1: rapordaki "Rutinime ekle" → routine_items (kind: step | exercise | habit, ref_id katalog id'si). RLS: kendi satırları.
import { EXERCISES } from "@/content/exercises";
import { HABITS } from "@/content/habits";
import { SKIN_STEPS } from "@/content/skin-steps";
import type { CoachReport } from "@/lib/ai/reportSchema";
import { createClient } from "@/lib/db/browser";

export type RoutineItemInsert = { user_id: string; kind: "step" | "exercise" | "habit"; ref_id: string; slot: "morning" | "evening" | "daily" | "weekly"; title: string; position: number };

export function routineItemsFromReport(report: CoachReport, userId: string, includeExercises: boolean): RoutineItemInsert[] {
  const items: RoutineItemInsert[] = [];
  let pos = 0;
  const stepMap = new Map(SKIN_STEPS.map((s) => [s.id, s]));
  for (const slot of ["morning", "evening", "weekly"] as const) {
    for (const s of report.skincare[slot]) {
      const def = stepMap.get(s.stepType);
      if (def) items.push({ user_id: userId, kind: "step", ref_id: def.id, slot, title: def.nameTr, position: pos++ });
    }
  }
  if (includeExercises) {
    const exMap = new Map(EXERCISES.map((e) => [e.id, e]));
    for (const e of report.exercises) {
      const def = exMap.get(e.id);
      if (def) items.push({ user_id: userId, kind: "exercise", ref_id: def.id, slot: def.slot, title: def.nameTr, position: pos++ });
    }
  }
  const hbMap = new Map(HABITS.map((h) => [h.id, h]));
  for (const h of report.habits) {
    const def = hbMap.get(h.id);
    if (def) items.push({ user_id: userId, kind: "habit", ref_id: def.id, slot: def.slot, title: `${def.nameTr}: ${h.target}`, position: pos++ });
  }
  return items;
}

/** Mevcut aynı ref_id'ler atlanır. Döner: eklenen sayısı. */
export async function addReportToRoutine(report: CoachReport, includeExercises: boolean): Promise<number> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("no_session");
  const { data: existing } = await supabase.from("routine_items").select("ref_id").eq("active", true);
  const have = new Set((existing ?? []).map((r) => String(r.ref_id)));
  const items = routineItemsFromReport(report, userId, includeExercises).filter((i) => !have.has(i.ref_id));
  if (items.length === 0) return 0;
  const { error } = await supabase.from("routine_items").insert(items);
  if (error) throw error;
  return items.length;
}
