import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { getTeaserConfig } from "@/lib/config/teaser";
import type { ClientAnalysis } from "@/lib/score/present";
import { AnalysisProgress } from "@/mobile/src/components/analysis/AnalysisProgress";
import { ScoreView } from "@/mobile/src/components/analysis/ScoreView";
import { Screen } from "@/mobile/src/components/ui/Screen";
import { Text } from "@/mobile/src/components/ui/Text";
import { PaywallProvider } from "@/mobile/src/features/paywall/PaywallSheet";
import { useSession } from "@/mobile/src/features/session/SessionProvider";
import { ApiClientError } from "@/mobile/src/lib/api";
import { scoped } from "@/mobile/src/lib/i18n";

const t = scoped("analysis");
type Status = { premium: boolean };

/** /analiz/[id]: GET /api/analyses/[id] (sunucu kırpılmış görünüm; kilitli değer gelmez). */
export default function AnalysisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSession();
  const [a, setA] = useState<ClientAnalysis | null>(null);
  const [premium, setPremium] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([api.get<ClientAnalysis>(`/api/analyses/${id}`), api.get<Status>("/api/billing/status")])
      .then(([res, st]) => {
        if (!active) return;
        setA(res);
        setPremium(Boolean(st?.premium));
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof ApiClientError ? e.code : "NETWORK");
      });
    return () => {
      active = false;
    };
  }, [api, id]);

  // Teaser modu sunucunun ürettiği kilitlerde zaten uygulanmıştır; burada yalnız analitik etiketi için okunur.
  const teaserMode = getTeaserConfig({ TEASER_MODE: process.env.EXPO_PUBLIC_TEASER_MODE }).mode;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t("overallTitle"), headerBackTitle: "Geri" }} />
      <Screen>
        {error ? <Text>{t(`errors.${error}`) === `analysis.errors.${error}` ? t("errors.GENERIC") : t(`errors.${error}`)}</Text> : null}
        {!a && !error ? <AnalysisProgress done={false} /> : null}
        {a && a.status !== "completed" ? <Text variant="muted">{a.status === "failed" ? t("statusFailed") : t("statusProcessing")}</Text> : null}
        {a && a.status === "completed" ? (
          <PaywallProvider teaserMode={teaserMode}>
            <ScoreView a={a} premium={premium} />
          </PaywallProvider>
        ) : null}
      </Screen>
    </>
  );
}
