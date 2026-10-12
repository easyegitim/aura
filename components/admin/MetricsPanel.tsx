"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Activity = { day: string; analyses_completed: number; analyses_failed: number; reports: number; fallback_reports: number; tryons_success: number; tryons_identity_drift: number; tryons_failed: number };
type Cost = { day: string; analysis_calls: number; reports: number; tryon_generations: number; est_cost_usd: number };
type Sub = { plan: string; active_count: number; canceling_count: number };
type Funnel = { profiles: number; adults: number; questionnaire_completed: number; analyzed_users: number; ever_checked_out: number; premium_now: number };
type Reported = { id: string; target_type: string; target_id: string | null; reason: string | null; created_at: string };
type Metrics = { days: number; dailyActivity: Activity[]; dailyAiCost: Cost[]; activeSubscriptions: Sub[]; funnel: Funnel | null; reportedContent: Reported[] };

const num = (n: number) => n.toLocaleString("tr-TR");
const pct = (a: number, b: number) => (b > 0 ? `%${Math.round((a / b) * 100)}` : "–");

/** F18 /admin: günlük sayılar, AI maliyeti, huni, abonelikler, bildirilen içerikler (0005_ops). Grafik değil tablo. */
export function MetricsPanel() {
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/metrics?days=30", { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as Metrics;
      })
      .then((m) => {
        if (!cancelled) setData(m);
      })
      .catch(() => {
        if (!cancelled) setError("Metrikler alınamadı.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Metrikler yükleniyor…</p>;

  const sum = (k: keyof Activity) => data.dailyActivity.reduce((s, d) => s + Number(d[k] ?? 0), 0);
  const totalCost = data.dailyAiCost.reduce((s, d) => s + Number(d.est_cost_usd ?? 0), 0);
  const f = data.funnel;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Son {data.days} gün</CardTitle>
          <CardDescription>Analiz, rapor ve deneme sayıları; tahmini AI maliyeti (SPEC 5.4 birim fiyatları).</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <div><dt className="text-muted-foreground">Analiz tamam</dt><dd className="font-medium">{num(sum("analyses_completed"))}</dd></div>
            <div><dt className="text-muted-foreground">Analiz hata</dt><dd className="font-medium">{num(sum("analyses_failed"))}</dd></div>
            <div><dt className="text-muted-foreground">Rapor (fallback)</dt><dd className="font-medium">{num(sum("reports"))} ({num(sum("fallback_reports"))})</dd></div>
            <div><dt className="text-muted-foreground">Deneme başarı / drift / hata</dt><dd className="font-medium">{num(sum("tryons_success"))} / {num(sum("tryons_identity_drift"))} / {num(sum("tryons_failed"))}</dd></div>
            <div><dt className="text-muted-foreground">Tahmini AI maliyeti</dt><dd className="font-medium">${totalCost.toFixed(2)}</dd></div>
          </dl>
        </CardContent>
      </Card>

      {f ? (
        <Card>
          <CardHeader>
            <CardTitle>Huni</CardTitle>
            <CardDescription>Profil → 18+ → anket → analiz → ödeme (toplam).</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ["Profil", f.profiles, f.profiles],
                  ["18+", f.adults, f.profiles],
                  ["Anket tamam", f.questionnaire_completed, f.adults],
                  ["Analiz yapan", f.analyzed_users, f.questionnaire_completed],
                  ["Ödeme denemesi", f.ever_checked_out, f.analyzed_users],
                  ["Şu an premium", f.premium_now, f.analyzed_users],
                ].map(([label, v, base]) => (
                  <tr key={String(label)} className="border-b last:border-0">
                    <td className="py-1 text-muted-foreground">{label}</td>
                    <td className="py-1 text-right font-medium">{num(Number(v))}</td>
                    <td className="py-1 text-right text-muted-foreground">{pct(Number(v), Number(base))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Aktif abonelikler</CardTitle>
        </CardHeader>
        <CardContent>
          {data.activeSubscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aktif abonelik yok.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground"><th className="py-1">Plan</th><th className="py-1 text-right">Aktif</th><th className="py-1 text-right">İptal planlı</th></tr></thead>
              <tbody>
                {data.activeSubscriptions.map((s) => (
                  <tr key={s.plan} className="border-b last:border-0"><td className="py-1">{s.plan}</td><td className="py-1 text-right">{num(s.active_count)}</td><td className="py-1 text-right">{num(s.canceling_count)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Günlük</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-xs">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1">Gün</th><th className="py-1 text-right">Analiz</th><th className="py-1 text-right">Hata</th><th className="py-1 text-right">Rapor</th><th className="py-1 text-right">Deneme</th><th className="py-1 text-right">Drift</th><th className="py-1 text-right">USD</th></tr></thead>
            <tbody>
              {data.dailyActivity.map((d) => {
                const c = data.dailyAiCost.find((x) => x.day === d.day);
                return (
                  <tr key={d.day} className="border-b last:border-0">
                    <td className="py-1">{d.day}</td><td className="py-1 text-right">{num(d.analyses_completed)}</td><td className="py-1 text-right">{num(d.analyses_failed)}</td><td className="py-1 text-right">{num(d.reports)}</td><td className="py-1 text-right">{num(d.tryons_success)}</td><td className="py-1 text-right">{num(d.tryons_identity_drift)}</td><td className="py-1 text-right">{c ? Number(c.est_cost_usd).toFixed(2) : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bildirilen içerikler</CardTitle>
          <CardDescription>&ldquo;Uygunsuz içerik bildir&rdquo; kayıtları (son 50). Fotoğraf veya kullanıcı kimliği yoktur.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.reportedContent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bildirim yok.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {data.reportedContent.map((r) => (
                <li key={r.id} className="rounded-md border p-2">
                  <div className="flex justify-between text-xs text-muted-foreground"><span>{r.target_type}{r.target_id ? ` · ${r.target_id.slice(0, 8)}…` : ""}</span><span>{new Date(r.created_at).toLocaleString("tr-TR")}</span></div>
                  <p className="mt-1 whitespace-pre-wrap">{r.reason ?? "(gerekçe yok)"}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
