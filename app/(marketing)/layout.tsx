import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LegalLinks } from "@/components/marketing/LegalLinks";
import { StartAnalysisButton } from "@/components/marketing/StartAnalysisButton";
import { APP_NAME } from "@/lib/config/app";

export default async function MarketingLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            {APP_NAME}
          </Link>
          <nav className="flex items-center gap-2" aria-label="Üst menü">
            <Link href="/fiyatlar" className="px-2 text-sm text-muted-foreground hover:text-foreground">
              {t("nav.pricing")}
            </Link>
            <StartAnalysisButton size="sm" />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t">
        <div className="mx-auto w-full max-w-5xl space-y-3 px-4 py-6">
          <LegalLinks />
          <p className="text-xs text-muted-foreground">{t("common.adultOnly")} {t("common.photoNotStored")}</p>
          <p className="text-xs text-muted-foreground">{t("legal.rights", { year: new Date().getFullYear(), appName: APP_NAME })}</p>
        </div>
      </footer>
    </div>
  );
}
