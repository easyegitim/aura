"use client";

// SPEC 11.1: rapordaki "Rutinime ekle" → routine_items (kind: step | exercise | habit, ref_id katalog id'si). RLS: kendi satırları.
import type { CoachReport } from "@/lib/ai/reportSchema";
import { createClient } from "@/lib/db/browser";
import { routineItemsFromReport } from "./fromReport";

export { routineItemsFromReport, type RoutineItemInsert } from "./fromReport";

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
