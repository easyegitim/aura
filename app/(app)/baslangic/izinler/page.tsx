import { redirect } from "next/navigation";
import { ConsentFlow } from "@/components/onboarding/ConsentFlow";
import { getConsentState } from "@/lib/api/guard";
import { createClient } from "@/lib/db/server";
import { getLegalDoc } from "@/lib/legal/docs";
import { AGE_GATE_PATH, QUESTIONNAIRE_PATH } from "@/lib/onboarding/gate";

/** F03: aydınlatma + açık rızalar. 18+ değilse yaş kapısına döner. */
export default async function ConsentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: profile } = await supabase.from("profiles").select("is_adult").eq("id", user.id).maybeSingle();
  if (!profile?.is_adult) redirect(AGE_GATE_PATH);

  const [notice, consentDoc, state] = await Promise.all([getLegalDoc("aydinlatma"), getLegalDoc("acik-riza"), getConsentState(supabase)]);
  const ack = state.kvkk_notice_ack;
  const noticeAcked = Boolean(ack?.granted && ack.textVersion === notice.version);

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <ConsentFlow
        notice={{ title: notice.title, version: notice.version, updatedAt: notice.updatedAt, body: notice.body }}
        consentVersion={consentDoc.version}
        initial={state}
        noticeAcked={noticeAcked}
        nextPath={QUESTIONNAIRE_PATH}
      />
    </div>
  );
}
