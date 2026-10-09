import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { withGuard } from "@/lib/api/guard";
import { getPremiumStatus } from "@/lib/api/premium";
import { renderContracts } from "@/lib/billing/contracts";
import { IyzicoError } from "@/lib/billing/iyzico";
import { initializeOneTimeCheckout, initializeSubscriptionCheckout } from "@/lib/billing/subscriptions";
import { APP_NAME, APP_URL } from "@/lib/config/app";
import { isFeatureEnabled } from "@/lib/config/flags";
import { PLANS, SUBSCRIPTION_PLAN_IDS } from "@/lib/config/plans";
import { createAdminClient } from "@/lib/db/admin";
import { getLegalVersion } from "@/lib/legal/docs";

export const runtime = "nodejs";

const Input = z.object({
  plan: z.enum([...SUBSCRIPTION_PLAN_IDS, "week_pass"]),
  buyer: z.object({
    name: z.string().trim().min(2).max(60),
    surname: z.string().trim().min(2).max(60),
    gsmNumber: z.string().trim().regex(/^\+?[0-9]{10,15}$/),
    identityNumber: z.string().trim().regex(/^[0-9]{11}$/).optional(),
    city: z.string().trim().min(2).max(60),
    address: z.string().trim().min(10).max(300),
    zipCode: z.string().trim().max(10).optional(),
  }),
  accepted: z.object({ terms: z.literal(true), waiver: z.literal(true) }),
});

/**
 * SPEC 14 / 15.2: POST /api/billing/checkout → { checkoutFormContent, token }.
 * Kalıcı hesap (anonim değil), 18+, aktif abonelik yok. İki onay consents'e yazılır. Kart bilgisi bize gelmez.
 */
export const POST = withGuard({ schema: Input, allowAnonymous: false, requireAdult: true }, async ({ user, supabase, input }) => {
  if (input.plan === "week_pass" && !isFeatureEnabled("weekPass")) throw new ApiError("FEATURE_DISABLED", "Bu plan kapalı.");
  const { premium } = await getPremiumStatus(supabase, user.id);
  if (premium) throw new ApiError("ALREADY_SUBSCRIBED", "Zaten aktif bir aboneliğin var.");
  const email = user.email;
  if (!email) throw new ApiError("ANONYMOUS_NOT_ALLOWED", "E-posta gerekli.");

  // SPEC 15.2 adım 4: iki zorunlu onay consents'e yazılır (metin sürümleriyle).
  const [saleV, infoV] = await Promise.all([getLegalVersion("mesafeli-satis"), getLegalVersion("on-bilgilendirme")]);
  const { error: cErr } = await supabase.from("consents").insert([
    { user_id: user.id, type: "distance_sales_terms", granted: true, text_version: saleV },
    { user_id: user.id, type: "instant_performance_waiver", granted: true, text_version: infoV },
  ]);
  if (cErr) throw new Error("consent insert failed");

  const conversationId = crypto.randomUUID();
  const callbackUrl = `${APP_URL}/api/billing/callback`;
  const buyer = { ...input.buyer, email };
  const admin = createAdminClient();

  try {
    const init =
      input.plan === "week_pass"
        ? await initializeOneTimeCheckout({
            buyer,
            userId: user.id,
            conversationId,
            callbackUrl,
            priceTry: PLANS.week_pass.priceTry,
            name: `${APP_NAME} 7 Günlük Geçiş`,
            ip: "0.0.0.0",
          })
        : await initializeSubscriptionCheckout({ plan: input.plan, buyer, conversationId, callbackUrl });
    if (!init.checkoutFormContent || !init.token) throw new ApiError("AI_FAILED", "Ödeme formu alınamadı.");

    // Bekleyen satır: token conversationId ile eşleşir; premium YALNIZ iyzico doğrulamasıyla açılır.
    const { error } = await admin.from("subscriptions").upsert(
      { user_id: user.id, provider: "iyzico", plan: input.plan, status: "pending", provider_subscription_ref: null, cancel_at_period_end: false, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    if (error) throw new Error("pending subscription upsert failed");
    await admin.from("payment_events").insert({ provider: "iyzico", event_key: `checkout:${init.token}`, payload: { conversationId, plan: input.plan, userId: user.id, token: init.token } });

    // Sözleşme + ön bilgilendirme kopyası (Resend) — e-posta gönderimi callback'te başarı sonrası yapılır; burada yalnız hazırlanır.
    await renderContracts({ plan: input.plan, buyerName: `${buyer.name} ${buyer.surname}`, buyerEmail: email, buyerAddress: `${buyer.address}, ${buyer.city}` });

    return Response.json({ checkoutFormContent: init.checkoutFormContent, token: init.token });
  } catch (e) {
    if (e instanceof IyzicoError) throw new ApiError("AI_FAILED", `Ödeme sağlayıcısı: ${e.message}`);
    throw e;
  }
});
