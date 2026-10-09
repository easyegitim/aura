import { useTranslations } from "next-intl";
import Link from "next/link";

export const LEGAL_SLUGS = ["aydinlatma", "gizlilik", "cerez", "kullanim-kosullari", "mesafeli-satis", "on-bilgilendirme"] as const;

export function LegalLinks({ className }: { className?: string }) {
  const t = useTranslations("legal.links");
  return (
    <nav aria-label="Yasal" className={className}>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {LEGAL_SLUGS.map((slug) => (
          <li key={slug}>
            <Link href={`/yasal/${slug}`} className="underline-offset-4 hover:underline">
              {t(slug)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
