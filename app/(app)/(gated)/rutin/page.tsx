import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RoutineScreen } from "@/components/routine/RoutineScreen";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPremiumStatus } from "@/lib/api/premium";
import { exerciseEligible } from "@/lib/coach/eligibility";
import { createClient } from "@/lib/db/server";
import { QuestionnaireSchema } from "@/lib/questionnaire";

/** /rutin (F12): premium. */
export default async function RoutinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const [t, { premium }, profile] = await Promise.all([getTranslations("routine"), getPremiumStatus(supabase, user.id), supabase.from("profiles").select("questionnaire").eq("id", user.id).maybeSingle()]);
  const q = QuestionnaireSchema.safeParse(profile.data?.questionnaire);
  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      {premium ? (
        <RoutineScreen userId={user.id} exerciseEligible={q.success ? exerciseEligible(q.data) : false} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("lockedTitle")}</CardTitle>
            <CardDescription>{t("lockedBody")}</CardDescription>
          </CardHeader>
          <CardContent><Button asChild className="w-full"><Link href="/premium?from=routine">{t("goPremium")}</Link></Button></CardContent>
        </Card>
      )}
    </div>
  );
}
