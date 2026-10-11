import "server-only";

import type { ReferralStatus } from "./refCode";
import { signStatusLink } from "./refCode";
import { APP_NAME, APP_URL } from "@/lib/config/app";

export type AnalysisSummary = {
  overall: number | null;
  potential: number | null;
  subscores: Record<string, number> | null;
  observations: Record<string, string> | null;
  faceShape: string | null;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Partnere giden e-posta: ad, iletişim, mesaj, (rızayla) analiz özeti — fotoğraf ASLA. Durum linkleri imzalıdır. */
export function partnerRequestEmail(input: {
  partnerName: string;
  refCode: string;
  specialty: string;
  contact: string;
  name: string;
  message: string | null;
  summary: AnalysisSummary | null;
}): { subject: string; html: string } {
  const link = (status: ReferralStatus, label: string) =>
    `<a href="${APP_URL}/api/experts/requests/${encodeURIComponent(input.refCode)}/status?status=${status}&sig=${signStatusLink(input.refCode, status)}">${label}</a>`;
  const summary = input.summary
    ? `<h3>Analiz özeti (kullanıcının rızasıyla; fotoğraf paylaşılmaz)</h3>
<ul>
<li>Yüz şekli: ${esc(input.summary.faceShape ?? "-")}</li>
<li>Genel skor: ${input.summary.overall ?? "-"} · Potansiyel: ${input.summary.potential ?? "-"}</li>
<li>Alt skorlar: ${esc(JSON.stringify(input.summary.subscores ?? {}))}</li>
<li>Gözlemler: ${esc(JSON.stringify(input.summary.observations ?? {}))}</li>
</ul>`
    : "<p>Kullanıcı analiz özetini paylaşmadı.</p>";
  return {
    subject: `${APP_NAME} ön görüşme talebi · ${input.refCode}`,
    html: `<h2>Yeni ön görüşme talebi</h2>
<p>Sayın ${esc(input.partnerName)}, ${APP_NAME} üzerinden <strong>${esc(input.specialty)}</strong> alanında bir ön görüşme talebi aldınız.</p>
<ul>
<li>Referans: <strong>${esc(input.refCode)}</strong></li>
<li>Ad: ${esc(input.name)}</li>
<li>İletişim: ${esc(input.contact)}</li>
<li>Mesaj: ${esc(input.message ?? "-")}</li>
</ul>
${summary}
<p>Durumu güncelle: ${link("contacted", "İletişime geçildi")} · ${link("booked", "Randevu verildi")} · ${link("completed", "Tamamlandı")} · ${link("cancelled", "İptal")}</p>
<p style="color:#666;font-size:12px">Bu e-posta ${APP_NAME} tarafından otomatik gönderildi. Kullanıcı verisi yalnız bu talep için kullanılabilir; üçüncü kişilerle paylaşılamaz.</p>`,
  };
}
