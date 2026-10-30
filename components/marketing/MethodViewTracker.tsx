"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { METHOD_FROM, type MethodFrom } from "@/lib/config/method";

/** `from` kapalı listede değilse "direct" (UI spec §5.2). Saf; birim testi var. */
export function parseMethodFrom(raw: unknown): MethodFrom {
  return METHOD_FROM.find((f) => f === raw) ?? "direct";
}

/** /yontem görüntülenmesi (method_viewed). Yalnız kaynak sayfa kodu gönderilir; kullanıcı verisi yok. */
export function MethodViewTracker({ from }: { from: MethodFrom }) {
  useEffect(() => {
    track("method_viewed", { from });
  }, [from]);
  return null;
}
