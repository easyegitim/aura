import type { ApiErrorBody } from "@/lib/api/errors";
import { isApiErrorBody } from "@/lib/api/errors";
import { env } from "./env";

export class ApiClientError extends Error {
  readonly code: ApiErrorBody["error"]["code"] | "NETWORK";
  readonly status: number;
  readonly retryAt?: string;
  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.error.message ?? "Ağ hatası");
    this.code = body?.error.code ?? "NETWORK";
    this.status = status;
    this.retryAt = body?.error.retryAt;
  }
}

export type TokenSource = () => Promise<string | null>;

/** Mobil API istemcisi: her isteğe Authorization: Bearer <access_token> (SPEC-MOBILE M2). Saf; fetch ve token enjekte edilir. */
export function createApiClient(getToken: TokenSource, fetchImpl: typeof fetch = fetch, baseUrl = env.apiUrl) {
  async function request<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T | null> {
    const token = await getToken();
    const headers: Record<string, string> = { accept: "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    const res = await fetchImpl(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.status === 204) return null;
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new ApiClientError(res.status, isApiErrorBody(data) ? data : null);
    return data as T;
  }
  return {
    get: <T>(path: string) => request<T>("GET", path),
    post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
    patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  };
}
