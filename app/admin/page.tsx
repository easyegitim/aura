import { notFound } from "next/navigation";
import { PartnersAdmin } from "@/components/admin/PartnersAdmin";
import { isAdminUser } from "@/lib/api/admin";
import { isFeatureEnabled } from "@/lib/config/flags";
import { createClient } from "@/lib/db/server";

/** /admin (SPEC 4.2): yalnız ADMIN_EMAILS; yetkisiz → 404. Metrikler Faz 14'te eklenir. */
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminUser(user)) notFound();
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Yönetim</h1>
      <p className="text-sm text-muted-foreground">Uzman Ağı flag: {isFeatureEnabled("expertNetwork") ? "AÇIK" : "KAPALI"} · Metrikler Faz 14&apos;te.</p>
      <PartnersAdmin />
    </div>
  );
}
