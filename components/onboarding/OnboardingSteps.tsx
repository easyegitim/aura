import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const STEPS = ["age", "consents", "profile"] as const;

/** Başlangıç akışının üç aşaması (yaş → izinler → profil). Yalnız görsel yönlendirme; erişim kontrolü sunucuda. */
export function OnboardingSteps({ current }: { current: (typeof STEPS)[number] }) {
  const t = useTranslations("onboarding.flow");
  const index = STEPS.indexOf(current);
  return (
    <nav aria-label={t("label")} className="space-y-2">
      <ol className="grid grid-cols-3 gap-1.5">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === index ? "step" : undefined}>
            <span className={cn("block h-1 rounded-full", i <= index ? "bg-brand-gradient" : "bg-track")} aria-hidden="true" />
            <span className={cn("mt-1.5 block text-[11px] font-medium", i === index ? "text-foreground" : "text-muted-foreground")}>
              {t(s)}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
