import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { ExpertDirectory } from "@/components/experts/ExpertDirectory";
import { getConsentState } from "@/lib/api/guard";
import { isFeatureEnabled } from "@/lib/config/flags";
import { CONSENT_DOC } from "@/lib/consent";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { getLegalVersion } from "@/lib/legal/docs";

/** /uzman (F19): flag kapalı → 404 (SPEC 4.2). */
export default async function ExpertsPage({ searchParams }: PageProps<"/uzman">) {
  if (!isFeatureEnabled("expertNetwork")) notFound();
  const { alan } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const [t, state, version, last] = await Promise.all([
    getTranslations("experts"),
    getConsentState(supabase),
    getLegalVersion(CONSENT_DOC.expert_data_sharing),
    createAdminClient().from("analyses").select("id").eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const c = state.expert_data_sharing;
  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <ExpertDirectory
        initialSpecialty={typeof alan === "string" ? alan : undefined}
        lastAnalysisId={last.data?.id ? String(last.data.id) : null}
        sharingConsent={{ has: Boolean(c?.granted && c.textVersion === version), version }}
      />
    </div>
  );
}
