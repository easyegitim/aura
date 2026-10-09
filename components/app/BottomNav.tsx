"use client";

import { CalendarCheck, ClipboardList, ScanFace, Scissors, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/analiz", key: "analysis", Icon: ScanFace },
  { href: "/plan", key: "plan", Icon: ClipboardList },
  { href: "/dene", key: "tryon", Icon: Scissors },
  { href: "/rutin", key: "routine", Icon: CalendarCheck },
  { href: "/ilerleme", key: "progress", Icon: TrendingUp },
] as const;

/** Onboarding ve çekim ekranlarında alt gezinme gizlenir. */
const HIDDEN_PREFIXES = ["/baslangic", "/tara", "/premium"];

export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav
      aria-label="Ana gezinme"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {ITEMS.map(({ href, key, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
