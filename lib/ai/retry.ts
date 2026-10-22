// AI sağlayıcı çağrıları için geçici hata (503 yoğunluk, 429 kota) tespiti ve yeniden deneme. Saf; birim testli.
// Hata özetinde yalnız durum kodu ve kısa mesaj vardır; görsel, istem veya yanıt içeriği asla loglanmaz.

const TRANSIENT = /\b(503|429)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|rate limit|Too Many Requests|Service Unavailable/i;

export function isTransientAiError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  return TRANSIENT.test(msg);
}

/** Loga uygun kısa özet: {"error":{"code":503,...}} gövdesinden kod + durum, yoksa mesajın ilk 120 karakteri. */
export function aiErrorSummary(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  try {
    const j = JSON.parse(msg) as { error?: { code?: number; status?: string; message?: string } };
    if (j?.error) return `${j.error.code ?? "?"} ${j.error.status ?? ""} ${(j.error.message ?? "").slice(0, 80)}`.trim();
  } catch {
    // düz metin
  }
  return msg.replace(/\s+/g, " ").slice(0, 120);
}

export type RetryOptions = {
  /** Toplam deneme = 1 + retries. */
  retries: number;
  baseDelayMs: number;
  signal?: AbortSignal;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, error: unknown) => void;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Geçici hatada üstel bekleme ile tekrar; kalıcı hata veya iptal anında fırlatılır. */
export async function withTransientRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (e) {
      if (attempt >= opts.retries || !isTransientAiError(e) || opts.signal?.aborted) throw e;
      opts.onRetry?.(attempt + 1, e);
      await sleep(opts.baseDelayMs * 2 ** attempt);
      if (opts.signal?.aborted) throw e;
    }
  }
}
