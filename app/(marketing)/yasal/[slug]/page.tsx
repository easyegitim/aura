import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/legal/Markdown";
import { Badge } from "@/components/ui/badge";
import { getLegalDoc, isLegalSlug, listLegalSlugs } from "@/lib/legal/docs";

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await listLegalSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/yasal/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isLegalSlug(slug)) return {};
  const doc = await getLegalDoc(slug);
  return { title: doc.title };
}

/** F16: content/legal/*.md; sürüm ve tarih; development'ta "Avukat onayı bekleniyor" bandı. */
export default async function LegalPage({ params }: PageProps<"/yasal/[slug]">) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();
  const [doc, t] = await Promise.all([getLegalDoc(slug), getTranslations("legal")]);
  const showPendingBanner = process.env.NODE_ENV === "development" && !doc.approved;

  return (
    <article className="mx-auto w-full max-w-3xl space-y-5 px-4 py-10">
      {showPendingBanner ? (
        <p role="status" className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {t("pendingApproval")}
        </p>
      ) : null}
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{doc.title}</h1>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{t("version", { version: doc.version })}</Badge>
          <Badge variant="outline">{t("updatedAt", { date: doc.updatedAt })}</Badge>
        </div>
      </header>
      <Markdown>{doc.body}</Markdown>
    </article>
  );
}
