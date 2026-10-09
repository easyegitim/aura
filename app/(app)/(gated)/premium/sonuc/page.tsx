import { PaymentResult } from "@/components/billing/PaymentResult";

export default async function PaymentResultPage({ searchParams }: PageProps<"/premium/sonuc">) {
  const sp = await searchParams;
  const status = sp.status === "ok" || sp.status === "failed" ? sp.status : "pending";
  const analysisId = typeof sp.analysis === "string" ? sp.analysis : undefined;
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <PaymentResult status={status} analysisId={analysisId} />
    </div>
  );
}
