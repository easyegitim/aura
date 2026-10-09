import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ScoreTrend } from "@/components/analysis/ScoreTrend";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPremiumStatus } from "@/lib/api/premium";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { toClientSummary, type AnalysisRow } from "@/lib/score/present";

/** /analiz: geçmiş listesi (trend grafiği Faz 7). */
export default async function AnalysesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const [t, tg, { premium }] = await Promise.all([getTranslations("analysis"), getTranslations("geometry"), getPremiumStatus(supabase, user.id)]);
  const admin = createAdminClient();
  const { data } = await admin
    .from("analyses")
    .select("id, status, created_at, face_shape, overall, potential, subscores, gains, observations, geometry, calibration_version")
    .eq("user_id", user.id)
    .neq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(50);
  const items = (data ?? []).map((r) => toClientSummary(r as AnalysisRow, premium));
  const fmt = (n: number | null) => (n === null ? "●,●" : n.toLocaleString("tr-TR", { minimumFractionDigits: 1 }));

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("listTitle")}</h1>
        <Button asChild size="sm">
          <Link href="/tara">{t("newAnalysis")}</Link>
        </Button>
      </div>
      {premium && items.filter((i) => i.status === "completed").length >= 2 ? (
        <Card>
          <CardContent className="pt-4">
            <ScoreTrend
              points={items
                .filter((i) => i.status === "completed" && i.overall !== null && i.potential !== null)
                .map((i) => ({ id: i.id, date: i.createdAt, overall: i.overall!, potential: i.potential!, calibrationVersion: i.calibrationVersion }))}
            />
          </CardContent>
        </Card>
      ) : null}
      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("emptyTitle")}</CardTitle>
            <CardDescription>{t("emptyBody")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/tara">{t("newAnalysis")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li key={a.id}>
              <Link href={`/analiz/${a.id}`} className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm hover:bg-accent">
                <span>
                  {new Date(a.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                  <span className="block text-xs text-muted-foreground">{a.faceShape ? tg(`shapes.${a.faceShape}`) : a.status}</span>
                </span>
                <span className="text-lg font-semibold tabular-nums">{a.status === "completed" ? fmt(a.overall) : "…"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
