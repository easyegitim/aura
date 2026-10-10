import "server-only";

import { ENTITLEMENTS } from "@/lib/config/plans";
import { createAdminClient } from "@/lib/db/admin";

/** Kayan 7 günde kullanılan deneme sayısı (pending + success; SPEC 13.3 reserve_tryon ile aynı sayım). */
export async function tryonUsage(userId: string): Promise<{ used: number; limit: number; windowDays: number; since: string; nextAt: string | null }> {
  const admin = createAdminClient();
  const { windowDays, tryonsPerWindow } = ENTITLEMENTS.premium;
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  const { data } = await admin.from("tryon_events").select("created_at").eq("user_id", userId).in("status", ["pending", "success"]).gte("created_at", since).order("created_at", { ascending: true });
  const rows = data ?? [];
  const nextAt = rows.length >= tryonsPerWindow ? new Date(new Date(String(rows[0].created_at)).getTime() + windowDays * 86_400_000).toISOString() : null;
  return { used: rows.length, limit: tryonsPerWindow, windowDays, since, nextAt };
}
