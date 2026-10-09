import { z } from "zod";
import { withGuard } from "@/lib/api/guard";
import { getPremiumStatus } from "@/lib/api/premium";
import { getTeaserConfig } from "@/lib/config/teaser";
import { createAdminClient } from "@/lib/db/admin";
import { toClientAnalysis, type AnalysisRow } from "@/lib/score/present";

export const runtime = "nodejs";

/** GET /api/analyses/[id] → ClientAnalysis (sahiplik; teaser kırpması). Başkasının id'si → 404. */
export const GET = withGuard({}, async ({ req, user, supabase }) => {
  const id = new URL(req.url).pathname.split("/").pop() ?? "";
  if (!z.uuid().safeParse(id).success) return notFound();
  const admin = createAdminClient();
  const { data } = await admin
    .from("analyses")
    .select("id, status, created_at, face_shape, overall, potential, subscores, gains, observations, geometry, calibration_version")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return notFound();
  const { premium } = await getPremiumStatus(supabase, user.id);
  const teaser = getTeaserConfig();
  return Response.json(toClientAnalysis(data as AnalysisRow, premium, teaser.mode, teaser.subscore));
});

function notFound(): Response {
  // IDOR koruması: var/yok ayrımı yapılmaz (SPEC 20.2 "başka kullanıcının analiz id'si → 404").
  return Response.json({ error: { code: "NOT_FOUND", message: "Analiz bulunamadı." } }, { status: 404 });
}
