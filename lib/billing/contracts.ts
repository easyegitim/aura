import "server-only";

import { getLegalDoc } from "@/lib/legal/docs";
import { PLANS, formatTry, type PlanId } from "@/lib/config/plans";
import { markdownToBasicHtml } from "@/lib/email/resend";

const PERIOD_TR: Record<PlanId, string> = { weekly: "hafta", monthly: "ay", yearly: "yıl", week_pass: "7 gün (tek seferlik)" };
const NAME_TR: Record<PlanId, string> = { weekly: "Haftalık", monthly: "Aylık", yearly: "Yıllık", week_pass: "7 Günlük Geçiş" };

/** Mesafeli satış sözleşmesi ve ön bilgilendirme formu alıcı bilgisi ve fiyatla doldurulur (SPEC 15.3). */
export async function renderContracts(input: { plan: PlanId; buyerName: string; buyerEmail: string; buyerAddress: string }) {
  const [sale, info] = await Promise.all([getLegalDoc("mesafeli-satis"), getLegalDoc("on-bilgilendirme")]);
  const vars: Record<string, string> = {
    buyerName: input.buyerName,
    buyerEmail: input.buyerEmail,
    buyerAddress: input.buyerAddress,
    planName: NAME_TR[input.plan],
    price: formatTry(PLANS[input.plan].priceTry),
    period: PERIOD_TR[input.plan],
  };
  const fill = (md: string) => md.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "");
  return {
    saleVersion: sale.version,
    infoVersion: info.version,
    html: `<h1>${sale.title}</h1>${markdownToBasicHtml(fill(sale.body))}<hr/><h1>${info.title}</h1>${markdownToBasicHtml(fill(info.body))}`,
    saleMarkdown: fill(sale.body),
    infoMarkdown: fill(info.body),
  };
}
