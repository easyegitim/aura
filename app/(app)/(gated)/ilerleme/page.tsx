import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ScoreTrend } from "@/components/analysis/ScoreTrend";
import { ProgressScreen } from "@/components/progress/ProgressScreen";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPremiumStatus } from "@/lib/api/premium";
import { ENTITLEMENTS } from "@/lib/config/plans";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";

const epochNow = () => Date.now();

/** /ilerleme (F13): cihazdaki fotoğraflar (istemci), skor trendi (premium), 7 gün dolunca "Yeni analiz hakkın açıldı". */
export default async function ProgressPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const [t, { premium }] = await Promise.all([getTranslations("progress"), getPremiumStatus(supabase, user.id)]);

  let points: { id: string; date: string; overall: number; potential: number; calibrationVersion: string | null }[] = [];
  let newSlot = false;
  if (premium) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("analyses")
      .select("id, created_at, overall, potential, calibration_version, status")
      .eq("user_id", user.id)
      .in("status", ["completed", "processing"])
      .order("created_at", { ascending: false })
      .limit(52);
    const rows = data ?? [];
    points = rows.filter((r) => r.status === "completed" && r.overall !== null && r.potential !== null).map((r) => ({ id: String(r.id), date: String(r.created_at), overall: Number(r.overall), potential: Number(r.potential), calibrationVersion: r.calibration_version ? String(r.calibration_version) : null }));
    const last = rows[0];
    newSlot = !last || epochNow() - new Date(String(last.created_at)).getTime() >= ENTITLEMENTS.premium.windowDays * 86_400_000;
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      {premium && newSlot ? (
        <Card className="border-foreground">
          <CardHeader>
            <CardTitle>{t("newSlotTitle")}</CardTitle>
            <CardDescription>{t("newSlotBody")}</CardDescription>
          </CardHeader>
          <CardContent><Button asChild className="w-full"><Link href="/tara">{t("newAnalysis")}</Link></Button></CardContent>
        </Card>
      ) : null}
      {premium ? (
        <Card>
          <CardContent className="pt-4"><ScoreTrend points={points} /></CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("trendLockedTitle")}</CardTitle>
            <CardDescription>{t("trendLockedBody")}</CardDescription>
          </CardHeader>
          <CardContent><Button asChild variant="outline" className="w-full"><Link href="/premium?from=progress">{t("goPremium")}</Link></Button></CardContent>
        </Card>
      )}
      <ProgressScreen />
    </div>
  );
}
