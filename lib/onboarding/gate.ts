export const AGE_GATE_PATH = "/baslangic/yas";
export const CONSENTS_PATH = "/baslangic/izinler";

export type GateProfile = { is_adult: boolean; onboarding_completed_at: string | null } | null;

/**
 * SPEC Faz 2 madde 5: is_adult false → /baslangic/yas; onboarding_completed_at boş → /baslangic/izinler.
 * Profil satırı yoksa (tetikleyici henüz çalışmadı) yaş kapısına gönderilir. Saf fonksiyon; birim testi var.
 */
export function getOnboardingRedirect(profile: GateProfile): string | null {
  if (!profile || !profile.is_adult) return AGE_GATE_PATH;
  if (!profile.onboarding_completed_at) return CONSENTS_PATH;
  return null;
}
