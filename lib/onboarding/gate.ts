export const AGE_GATE_PATH = "/baslangic/yas";
export const CONSENTS_PATH = "/baslangic/izinler";
export const QUESTIONNAIRE_PATH = "/baslangic/anket";
export const CAPTURE_PATH = "/tara";
/** Silme talebi bekleyen hesap: "Silme talebini iptal et" ekranı (SPEC Faz 13 madde 4). */
export const DELETION_PATH = "/silme";

export type GateProfile = { is_adult: boolean; onboarding_completed_at: string | null; deletion_requested_at?: string | null } | null;

/**
 * SPEC Faz 2 madde 5: is_adult false → /baslangic/yas; onboarding_completed_at boş → /baslangic/izinler.
 * Faz 13: deletion_requested_at doluysa her uygulama ekranı /silme'ye döner (7 gün içinde iptal edilebilir).
 * Profil satırı yoksa (tetikleyici henüz çalışmadı) yaş kapısına gönderilir. Saf fonksiyon; birim testi var.
 */
export function getOnboardingRedirect(profile: GateProfile): string | null {
  if (!profile || !profile.is_adult) return AGE_GATE_PATH;
  if (profile.deletion_requested_at) return DELETION_PATH;
  if (!profile.onboarding_completed_at) return CONSENTS_PATH;
  return null;
}
