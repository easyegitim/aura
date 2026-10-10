import { getPreset } from "@/content/presets";
import { buildTryonPrompt } from "@/lib/ai/prompts/tryon.v1";
import { getTryonProvider } from "@/lib/ai/tryonProvider";
import { ApiError } from "@/lib/api/errors";
import { withGuard } from "@/lib/api/guard";
import { getPremiumStatus } from "@/lib/api/premium";
import { TRYON_IMAGE_MAX_BYTES, TryonInput, decodeJpegLimited } from "@/lib/api/tryonInput";
import { ENTITLEMENTS } from "@/lib/config/plans";
import { createAdminClient } from "@/lib/db/admin";
import { tryonUsage } from "@/lib/tryon/quota";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * SPEC 14 / 10.3: POST /api/tryon { clientRequestId, presetId, image } → { eventId, image }.
 * Premium; 18+; tryon_generation + cross_border_transfer; reserve_tryon (7 günde 10). Sunucu hiçbir görseli yazmaz.
 */
export const POST = withGuard(
  { schema: TryonInput, requireAdult: true, requireConsents: ["tryon_generation", "cross_border_transfer"] },
  async ({ user, supabase, input }) => {
    const { premium } = await getPremiumStatus(supabase, user.id);
    if (!premium) throw new ApiError("PREMIUM_REQUIRED", "Sanal deneme premiumda.");
    const preset = getPreset(input.presetId);
    if (!preset) throw new ApiError("BAD_PRESET", "Geçersiz stil.");
    const decoded = decodeJpegLimited(input.image, TRYON_IMAGE_MAX_BYTES);
    if ("error" in decoded) throw new ApiError(decoded.error, decoded.error === "IMAGE_TOO_LARGE" ? "Görsel 1,5 MB'ı aşıyor." : "Görsel JPEG değil.");

    const provider = getTryonProvider();
    const admin = createAdminClient();
    const { windowDays, tryonsPerWindow } = ENTITLEMENTS.premium;
    const { data: reservedId, error } = await admin.rpc("reserve_tryon", {
      p_user: user.id,
      p_client_request_id: input.clientRequestId,
      p_preset: preset.id,
      p_model: provider.model,
      p_limit: tryonsPerWindow,
      p_since: new Date(Date.now() - windowDays * 86_400_000).toISOString(),
    });
    if (error) throw new Error("reserve_tryon failed");
    if (!reservedId) {
      const u = await tryonUsage(user.id);
      throw new ApiError("QUOTA_EXCEEDED", "Bu haftaki deneme hakkın doldu.", u.nextAt ?? undefined);
    }

    const { data: existing } = await admin.from("tryon_events").select("status").eq("id", reservedId).single();
    if (existing && existing.status !== "pending") {
      // Aynı clientRequestId ile tekrar: görsel saklanmadığı için yeniden üretilemez; istemci yeni id ile dener.
      throw new ApiError("BAD_INPUT", "Bu istek daha önce işlendi; yeni bir deneme başlat.");
    }

    try {
      const out = await provider.generateTryOn({ imageBase64: input.image, maskBase64: input.mask, prompt: buildTryonPrompt(preset), preset });
      await admin.from("tryon_events").update({ status: "success" }).eq("id", reservedId);
      return Response.json({ eventId: reservedId, image: out.imageBase64, mimeType: out.mimeType, model: provider.model });
    } catch (e) {
      await admin.from("tryon_events").update({ status: "failed" }).eq("id", reservedId); // kota iade
      throw e;
    }
  },
);
