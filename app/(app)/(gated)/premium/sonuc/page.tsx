import { PaymentResult } from "@/components/billing/PaymentResult";
import { isUuid } from "@/lib/billing/returnAnalysis";

export default async function PaymentResultPage({ searchParams }: PageProps<"/premium/sonuc">) {
  const sp = await searchParams;
  const status = sp.status === "ok" || sp.status === "failed" ? sp.status : "pending";
  const analysisId = isUuid(sp.analysis) ? sp.analysis : undefined;
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <PaymentResult status={status} analysisId={analysisId} />
    </div>
  );
}
