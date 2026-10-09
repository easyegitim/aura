import { withGuard } from "@/lib/api/guard";
import { getPremiumStatus } from "@/lib/api/premium";

export const runtime = "nodejs";

/** GET /api/billing/status → { premium, plan, periodEnd, cancelAtPeriodEnd } */
export const GET = withGuard({}, async ({ user, supabase }) => {
  const s = await getPremiumStatus(supabase, user.id);
  const { data } = await supabase.from("subscriptions").select("cancel_at_period_end, status").eq("user_id", user.id).maybeSingle();
  return Response.json({ premium: s.premium, plan: s.plan, periodEnd: s.periodEnd, cancelAtPeriodEnd: Boolean(data?.cancel_at_period_end), status: data?.status ?? null });
});
