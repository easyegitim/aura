import { Stack, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, View } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { track } from "@/lib/analytics";
import { isFeatureEnabled } from "@/lib/config/flags";
import { Button } from "@/mobile/src/components/ui/Button";
import { Card } from "@/mobile/src/components/ui/Card";
import { OptionRow } from "@/mobile/src/components/ui/OptionRow";
import { Screen } from "@/mobile/src/components/ui/Screen";
import { Text } from "@/mobile/src/components/ui/Text";
import { LinkAccount } from "@/mobile/src/features/auth/LinkAccount";
import { packagesToPlans, type PlanOption } from "@/mobile/src/features/billing/plans";
import { ensurePurchases, isPurchasesConfigured, loadPackages, purchase, restore } from "@/mobile/src/features/billing/purchases";
import { useSession } from "@/mobile/src/features/session/SessionProvider";
import { scoped } from "@/mobile/src/lib/i18n";
import { spacing } from "@/mobile/src/theme";

const t = scoped("paywall");
const tp = scoped("pricing");
type Status = { premium: boolean; plan: string | null; periodEnd: string | null };

/**
 * /premium (SPEC 15.4, SPEC-MOBILE M6): hesap bağlama → mağaza paketleri (RevenueCat) → satın alma → sunucu eşitleme.
 * Satın alma sonucu istemcide premium açmaz: POST /api/billing/sync sunucuda RevenueCat'ten çeker; ekran status'u okur.
 */
export default function PremiumScreen() {
  const { user, api } = useSession();
  const [linked, setLinked] = useState(!(user?.is_anonymous ?? true));
  const [status, setStatus] = useState<Status | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  // Mağaza anahtarı yoksa yüklenecek paket de yoktur; başlangıç durumu buradan türetilir (effect içinde setState yok).
  const [options, setOptions] = useState<PlanOption[] | null>(() => (isPurchasesConfigured() ? null : []));
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshStatus = useCallback(async () => {
    const s = await api.get<Status>("/api/billing/status").catch(() => null);
    setStatus(s);
    return s;
  }, [api]);

  useEffect(() => {
    let active = true;
    void api
      .get<Status>("/api/billing/status")
      .then((s) => {
        if (active) setStatus(s);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [api]);

  useEffect(() => {
    if (!linked || !user || !isPurchasesConfigured()) return;
    let active = true;
    void (async () => {
      await ensurePurchases(user.id);
      const { packages: pk, store } = await loadPackages().catch(() => ({ packages: [], store: [] }));
      if (!active) return;
      setPackages(pk);
      const opts = packagesToPlans(store, isFeatureEnabled("weekPass"));
      setOptions(opts);
      setSelected(opts.find((o) => o.plan === "yearly")?.packageId ?? opts[0]?.packageId ?? null);
    })();
    return () => {
      active = false;
    };
  }, [linked, user]);

  async function syncAndFinish(after: "purchase" | "restore") {
    const s = await api.post<Status>("/api/billing/sync", {}).catch(() => null);
    const final = s ?? (await refreshStatus());
    if (final?.premium) {
      if (after === "purchase") track("subscription_activated", { plan: final.plan ?? "unknown" });
      Alert.alert(after === "restore" ? t("restored") : t("alreadyPremium"));
      router.back();
    } else {
      Alert.alert(t("pending"));
      setStatus(final);
    }
  }

  async function buy() {
    const pkg = packages.find((p) => p.identifier === selected);
    const opt = options?.find((o) => o.packageId === selected);
    if (!pkg || !opt) return;
    setBusy(true);
    try {
      track("checkout_started", { plan: opt.plan });
      const outcome = await purchase(pkg);
      if (outcome === "cancelled") {
        Alert.alert(t("purchaseCancelled"));
        return;
      }
      if (outcome === "error") {
        Alert.alert(t("purchaseError"));
        return;
      }
      await syncAndFinish("purchase");
    } finally {
      setBusy(false);
    }
  }

  async function restoreAll() {
    setBusy(true);
    try {
      if (!(await restore())) {
        Alert.alert(t("purchaseError"));
        return;
      }
      await syncAndFinish("restore");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t("pageTitle"), headerBackTitle: "Geri" }} />
      <Screen>
        <Text variant="title" accessibilityRole="header">{t("title")}</Text>
        <Text variant="muted">{t("body")}</Text>
        <View style={{ gap: spacing.xs }}>
          {(["i1", "i2", "i3", "i4"] as const).map((k) => (
            <Text key={k}>• {t(`includes.${k}`)}</Text>
          ))}
        </View>

        {status?.premium ? <Card description={t("alreadyPremium")} /> : null}

        {!linked ? (
          <Card title={t("linkFirstTitle")} description={t("linkFirstBody")}>
            <LinkAccount onLinked={() => setLinked(true)} />
          </Card>
        ) : null}

        {linked && !status?.premium ? (
          <Card title={t("choosePlan")} description={t("pageBody")}>
            {!isPurchasesConfigured() ? <Text variant="muted">{t("noOfferings")}</Text> : null}
            {options === null && isPurchasesConfigured() ? <Text variant="muted">…</Text> : null}
            {options && options.length === 0 && isPurchasesConfigured() ? <Text variant="muted">{t("noOfferings")}</Text> : null}
            {options?.map((o) => (
              <OptionRow
                key={o.packageId}
                kind="radio"
                selected={selected === o.packageId}
                onPress={() => setSelected(o.packageId)}
                label={`${o.plan === "week_pass" ? tp("weekPass") : tp(`plans.${o.plan}.name`)} · ${o.priceString}`}
              />
            ))}
            <Button title={t("buy")} size="lg" disabled={!selected || busy} busy={busy} onPress={buy} />
            <Button title={t("restore")} variant="ghost" disabled={busy} onPress={restoreAll} />
            <Text variant="small">{t("storeNote")}</Text>
            <Text variant="small">{t("note")}</Text>
          </Card>
        ) : null}
      </Screen>
    </>
  );
}
