import { z } from "zod";
import { offersAnalysisDeletion } from "@/lib/account/consents";
import { ApiError } from "@/lib/api/errors";
import { noContent, withGuard } from "@/lib/api/guard";
import { CONSENT_DOC, CONSENT_TYPES } from "@/lib/consent";
import { createAdminClient } from "@/lib/db/admin";
import { getLegalVersion } from "@/lib/legal/docs";

export const runtime = "nodejs";

const Input = z.object({
  type: z.enum(CONSENT_TYPES),
  granted: z.boolean(),
  textVersion: z.string().min(1).max(40),
  /** SPEC 16.2: biometric_processing geri alınırken "geçmiş analizlerin de silinsin mi?" (varsayılan evet). */
  deleteAnalyses: z.boolean().optional(),
});

/** SPEC 14: POST /api/consents { type, granted, textVersion, deleteAnalyses? } → 204. textVersion güncel olmalı. */
export const POST = withGuard({ schema: Input }, async ({ user, supabase, input }) => {
  const current = await getLegalVersion(CONSENT_DOC[input.type]);
  if (input.textVersion !== current) {
    throw new ApiError("BAD_INPUT", "Metin sürümü güncel değil; sayfayı yenile.");
  }
  // Kullanıcının kendi istemcisi: RLS p_consents_insert (user_id = auth.uid()) uygulanır. Geçmiş kayıt silinmez.
  const { error } = await supabase
    .from("consents")
    .insert({ user_id: user.id, type: input.type, granted: input.granted, text_version: input.textVersion });
  if (error) throw new Error("rıza kaydedilemedi");

  // Geri alma etkisi: yalnız biometric_processing + deleteAnalyses (varsayılan evet) → analyses ve coach_reports silinir.
  // analyses'e tarayıcı politikası yoktur; silme service role ile ve yalnız bu kullanıcının satırlarında.
  if (offersAnalysisDeletion(input.type, input.granted) && input.deleteAnalyses !== false) {
    const admin = createAdminClient();
    const { error: e1 } = await admin.from("coach_reports").delete().eq("user_id", user.id);
    if (e1) throw new Error("raporlar silinemedi");
    const { error: e2 } = await admin.from("analyses").delete().eq("user_id", user.id);
    if (e2) throw new Error("analizler silinemedi");
  }
  return noContent();
});
