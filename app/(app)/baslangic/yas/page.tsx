import { redirect } from "next/navigation";
import { AgeGate } from "@/components/onboarding/AgeGate";
import { OnboardingSteps } from "@/components/onboarding/OnboardingSteps";
import { createClient } from "@/lib/db/server";
import { currentYearIstanbul, selectableBirthYears } from "@/lib/onboarding/age";
import { CONSENTS_PATH } from "@/lib/onboarding/gate";

/** F03: doğum yılı. Zaten 18+ işaretliyse izinlere geç. */
export default async function AgeGatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: profile } = await supabase.from("profiles").select("is_adult").eq("id", user.id).maybeSingle();
  if (profile?.is_adult) redirect(CONSENTS_PATH);

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 px-4 py-6">
      <OnboardingSteps current="age" />
      <AgeGate years={selectableBirthYears(currentYearIstanbul())} nextPath={CONSENTS_PATH} />
    </div>
  );
}
