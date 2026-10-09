import { z } from "zod";
import { withGuard } from "@/lib/api/guard";
import { createAdminClient } from "@/lib/db/admin";
import { MIN_BIRTH_YEAR, currentYearIstanbul, isAdultByBirthYear } from "@/lib/onboarding/age";

export const runtime = "nodejs";

const Input = z.object({
  birthYear: z.number().int().min(MIN_BIRTH_YEAR),
});

/** SPEC 14: POST /api/onboarding/age { birthYear } → { isAdult }. is_adult sunucuda hesaplanır; 18 altıysa oturum kapatılır. */
export const POST = withGuard({ schema: Input }, async ({ user, supabase, input }) => {
  const year = currentYearIstanbul();
  if (input.birthYear > year) {
    return Response.json({ error: { code: "BAD_INPUT", message: "Doğum yılı gelecekte olamaz." } }, { status: 400 });
  }
  const isAdult = isAdultByBirthYear(input.birthYear, year);

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ birth_year: input.birthYear, is_adult: isAdult, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) throw new Error("profil güncellenemedi");

  if (!isAdult) {
    // SPEC 4.1 adım 3: 18 altı → devam yok, oturum kapatılır.
    await supabase.auth.signOut();
  }
  return Response.json({ isAdult });
});
