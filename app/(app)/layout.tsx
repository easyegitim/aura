import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app/AppHeader";
import { BottomNav } from "@/components/app/BottomNav";
import { createClient } from "@/lib/db/server";

/**
 * Oturum kapısı: oturum yoksa açılışa yönlendirir (Faz 1).
 * Faz 2'de eklenecek: is_adult=false → /baslangic/yas; onboarding_completed_at boş → /baslangic/izinler.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))]">{children}</main>
      <BottomNav />
    </div>
  );
}
