import { useTranslations } from "next-intl";

const ITEMS = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;

export function Faq() {
  const t = useTranslations("faq");
  return (
    <div className="divide-y rounded-xl border">
      {ITEMS.map((k) => (
        <details key={k} className="group px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            {t(`${k}.q`)}
            <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className="pt-2 text-sm text-muted-foreground">{t(`${k}.a`)}</p>
        </details>
      ))}
    </div>
  );
}
