import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { noContent, withGuard } from "@/lib/api/guard";
import { CONSENT_DOC, CONSENT_TYPES } from "@/lib/consent";
import { getLegalVersion } from "@/lib/legal/docs";

export const runtime = "nodejs";

const Input = z.object({
  type: z.enum(CONSENT_TYPES),
  granted: z.boolean(),
  textVersion: z.string().min(1).max(40),
});

/** SPEC 14: POST /api/consents { type, granted, textVersion } → 204. textVersion güncel olmalı. */
export const POST = withGuard({ schema: Input }, async ({ user, supabase, input }) => {
  const current = await getLegalVersion(CONSENT_DOC[input.type]);
  if (input.textVersion !== current) {
    throw new ApiError("BAD_INPUT", "Metin sürümü güncel değil; sayfayı yenile.");
  }
  // Kullanıcının kendi istemcisi: RLS p_consents_insert (user_id = auth.uid()) uygulanır.
  const { error } = await supabase
    .from("consents")
    .insert({ user_id: user.id, type: input.type, granted: input.granted, text_version: input.textVersion });
  if (error) throw new Error("rıza kaydedilemedi");
  return noContent();
});
