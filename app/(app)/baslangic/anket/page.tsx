import { redirect } from "next/navigation";
import { QuestionnaireWizard } from "@/components/onboarding/QuestionnaireWizard";
import { getConsentState } from "@/lib/api/guard";
import { hasRequiredAnalysisConsents } from "@/lib/consent";
import { createClient } from "@/lib/db/server";
import { getLegalVersion } from "@/lib/legal/docs";
import { AGE_GATE_PATH, CAPTURE_PATH, CONSENTS_PATH } from "@/lib/onboarding/gate";
import { QuestionnaireSchema } from "@/lib/questionnaire";

/** F04: anket. 18+ ve üç zorunlu rıza olmadan açılmaz. */
export default async function QuestionnairePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: profile } = await supabase.from("profiles").select("is_adult, questionnaire").eq("id", user.id).maybeSingle();
  if (!profile?.is_adult) redirect(AGE_GATE_PATH);

  const state = await getConsentState(supabase);
  const consentVersion = await getLegalVersion("acik-riza");
  if (!hasRequiredAnalysisConsents(state, () => consentVersion)) redirect(CONSENTS_PATH);

  const existing = QuestionnaireSchema.safeParse(profile.questionnaire);

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      {/* SPEC 7.1: model onboarding sırasında arka planda yüklenir */}
      <link rel="prefetch" href="/mediapipe/face_landmarker.task" as="fetch" crossOrigin="anonymous" />
      <link rel="prefetch" href="/mediapipe/wasm/vision_wasm_module_internal.wasm" as="fetch" crossOrigin="anonymous" />
      <QuestionnaireWizard nextPath={CAPTURE_PATH} initial={existing.success ? existing.data : undefined} />
    </div>
  );
}
