import { UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { APP_NAME } from "@/lib/config/app";

export async function AppHeader() {
  const t = await getTranslations("common");
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-lg items-center justify-between px-4">
        <Link href="/analiz" className="text-lg font-semibold tracking-tight">
          {APP_NAME}
        </Link>
        <Link
          href="/hesap"
          aria-label={t("account")}
          className="flex size-9 items-center justify-center rounded-full hover:bg-accent"
        >
          <UserRound className="size-5" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
