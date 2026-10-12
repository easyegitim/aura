import { withGuard } from "@/lib/api/guard";
import { createAdminClient } from "@/lib/db/admin";

export const runtime = "nodejs";

/** F18: GET /api/admin/metrics → 0005_ops görünümleri (0007 RPC ile) + bildirilen içerikler. ADMIN_EMAILS dışı 404. */
export const GET = withGuard({ requireAdmin: true }, async ({ req }) => {
  const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? 30) || 30));
  const admin = createAdminClient();
  const [activity, cost, subs, funnel, reported] = await Promise.all([
    admin.rpc("ops_daily_activity", { p_days: days }),
    admin.rpc("ops_daily_ai_cost", { p_days: days }),
    admin.rpc("ops_active_subscriptions"),
    admin.rpc("ops_funnel"),
    admin.rpc("ops_reported_content", { p_limit: 50 }),
  ]);
  const firstError = [activity, cost, subs, funnel, reported].find((r) => r.error)?.error;
  if (firstError) throw new Error(`metrics rpc: ${firstError.message}`);
  return Response.json({
    days,
    dailyActivity: activity.data ?? [],
    dailyAiCost: cost.data ?? [],
    activeSubscriptions: subs.data ?? [],
    funnel: (funnel.data ?? [])[0] ?? null,
    reportedContent: reported.data ?? [],
  });
});
