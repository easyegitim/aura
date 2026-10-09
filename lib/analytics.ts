// SPEC 17.1 olay adları. PostHog bağlantısı Faz 14'te (F17) eklenir; o zamana kadar no-op.
// Kural: olaylara fotoğraf, skor, metrik, e-posta eklenmez.
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

export function track<E extends AnalyticsEventName>(
  ...args: AnalyticsEvents[E] extends undefined ? [event: E] : [event: E, props: AnalyticsEvents[E]]
): void {
  // Faz 14: çerez onayı varsa posthog.capture(args[0], args[1])
  void args;
}
