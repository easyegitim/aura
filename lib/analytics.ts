// SPEC 17.1 olay adları. PostHog yalnız çerez onayı "granted" iken ve yalnız tarayıcıda çalışır
// (components/providers/AnalyticsProvider.tsx). Sunucuda track() no-op'tur.
// Kural: olaylara fotoğraf, skor, metrik, e-posta eklenmez; tip sistemi bunu zorlar.
// İstemci yapısal tiptedir: web posthog-js, mobil posthog-react-native aynı arayüzü sağlar.

export type AnalyticsEvents = {
  landing_cta_clicked: undefined;
  anon_session_started: undefined;
  age_blocked: undefined;
  consent_updated: { type: string; granted: boolean };
  questionnaire_completed: undefined;
  capture_started: { source: "camera" | "gallery" };
  capture_quality_failed: { reason: string };
  capture_succeeded: { attempts: number };
  analysis_completed: { tier: "free" | "premium" };
  analysis_failed: { reason: string };
  paywall_viewed: { trigger: string; teaserMode: string };
  account_linked: { method: "email" | "google" };
  checkout_started: { plan: string };
  subscription_activated: { plan: string };
  subscription_canceled: { plan: string };
  report_viewed: undefined;
  tryon_started: { presetKind: "hair" | "beard" | "color" };
  tryon_result: { status: string; durationMs: number };
  share_card_created: { withPhoto: boolean };
  routine_checked: { kind: "step" | "exercise" | "habit" };
  expert_request_sent: { specialty: string };
  feedback_sent: { targetType: string; rating: number | null };
  account_deletion_requested: undefined;
};

export type AnalyticsEventName = keyof AnalyticsEvents;

/** Olay özelliklerinde yasak anahtarlar (savunma: tip dışı çağrılara karşı çalışma zamanı filtresi). */
const FORBIDDEN_PROP = /^(image|photo|selfie|landmarks|points|email|overall|potential|subscores|metrics|geometry|score)$/i;

export function sanitizeProps(props: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!props) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (FORBIDDEN_PROP.test(k)) continue;
    if (typeof v === "string" && v.length > 200) continue;
    if (v !== null && typeof v === "object") continue;
    out[k] = v;
  }
  return out;
}

export type AnalyticsClient = {
  capture(event: string, properties?: Record<string, unknown>): unknown;
  getFeatureFlag(flag: string): unknown;
};

let client: AnalyticsClient | null = null;

/** AnalyticsProvider (web: çerez onayı, mobil: analitik izni) bağlar/çözer. */
export function setAnalyticsClient(c: AnalyticsClient | null): void {
  client = c;
}

export function isAnalyticsEnabled(): boolean {
  return client !== null;
}

export function track<E extends AnalyticsEventName>(
  ...args: AnalyticsEvents[E] extends undefined ? [event: E] : [event: E, props: AnalyticsEvents[E]]
): void {
  if (!client) return;
  const [event, props] = args as [E, Record<string, unknown> | undefined];
  try {
    client.capture(event, sanitizeProps(props));
  } catch {
    // analitik hiçbir akışı bozmaz
  }
}

/** Teaser A/B bayrağı (PostHog feature flag "teaser_mode"). Sunucu tarafı mod TEASER_MODE ortam değişkenidir;
 *  bayrak yalnız deney kaydı için okunur ve olaylara "teaserVariant" olarak eklenir. */
export function getTeaserVariant(): string | null {
  if (!client) return null;
  const v = client.getFeatureFlag("teaser_mode");
  return typeof v === "string" ? v : null;
}
