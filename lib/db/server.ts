import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseEnv } from "./env";

/**
 * Sunucu bileşenleri, route handler'lar ve server action'lar için istemci.
 * Oturum yenileme proxy.ts'te yapılır; Server Component içinde çerez yazılamazsa sessizce geçilir.
 */
export async function createClient() {
  // Önce cookies(): route dinamik olur, prerender'da yapılandırma hatası fırlatılmaz.
  const cookieStore = await cookies();
  const { url, key } = getPublicSupabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component'ten çağrıldı; proxy.ts oturumu zaten yeniliyor.
        }
      },
    },
  });
}
