import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import {
  DEADLINE_ABORT_REASON,
  classifyAnthropicError,
  readJsonText,
  readUsage,
  servedByFallback,
  summarizeAnthropicError,
} from "@/lib/ai/anthropic";

// engine spec §9.3: en özelden genele hata eşlemesi; SDK 1.3.0 hata sınıfları doğrudan kurulur (ağ yok).

const h = () => new Headers({ "request-id": "req_011CTestRequestId" });
const body = (type: string) => ({ type: "error", error: { type, message: "gizli istem içeriği burada olmamalı" } });

describe("classifyAnthropicError", () => {
  it("SDK sınıfları ve durum kodları", () => {
    expect(classifyAnthropicError(new Anthropic.RateLimitError(429, body("rate_limit_error"), undefined, h(), "rate_limit_error"))).toBe("transient");
    expect(classifyAnthropicError(new Anthropic.InternalServerError(529, body("overloaded_error"), undefined, h(), "overloaded_error"))).toBe("transient");
    expect(classifyAnthropicError(new Anthropic.InternalServerError(500, body("api_error"), undefined, h()))).toBe("transient");
    expect(classifyAnthropicError(new Anthropic.ConflictError(409, body("conflict"), undefined, h()))).toBe("transient");
    expect(classifyAnthropicError(new Anthropic.APIError(408, body("timeout_error"), undefined, h()))).toBe("transient");
    expect(classifyAnthropicError(new Anthropic.APIError(413, body("request_too_large"), undefined, h()))).toBe("too_large");
    expect(classifyAnthropicError(new Anthropic.BadRequestError(400, body("invalid_request_error"), undefined, h()))).toBe("fatal");
    expect(classifyAnthropicError(new Anthropic.AuthenticationError(401, body("authentication_error"), undefined, h()))).toBe("fatal");
    expect(classifyAnthropicError(new Anthropic.APIError(402, body("billing_error"), undefined, h()))).toBe("fatal");
    expect(classifyAnthropicError(new Anthropic.PermissionDeniedError(403, body("permission_error"), undefined, h()))).toBe("fatal");
    expect(classifyAnthropicError(new Anthropic.NotFoundError(404, body("not_found_error"), undefined, h()))).toBe("fatal");
    expect(classifyAnthropicError(new Anthropic.UnprocessableEntityError(422, body("invalid_request_error"), undefined, h()))).toBe("fatal");
  });
  it("bağlantı, zaman aşımı ve iptal", () => {
    expect(classifyAnthropicError(new Anthropic.APIConnectionTimeoutError())).toBe("timeout");
    expect(classifyAnthropicError(new Anthropic.APIConnectionError({ message: "Connection error." }))).toBe("transient");
    expect(classifyAnthropicError(new Anthropic.APIUserAbortError())).toBe("aborted");
    const deadline = new AbortController();
    deadline.abort(DEADLINE_ABORT_REASON);
    expect(classifyAnthropicError(new Anthropic.APIUserAbortError(), deadline.signal)).toBe("timeout");
    expect(classifyAnthropicError(new Anthropic.APIUserAbortError(), AbortSignal.abort(new DOMException("t", "TimeoutError")))).toBe("timeout");
    const early = new AbortController();
    early.abort();
    expect(classifyAnthropicError(new Anthropic.APIUserAbortError(), early.signal)).toBe("aborted");
  });
  it("SDK'nın başka kopyasından gelen hata: ileti ve durum koduyla", () => {
    expect(classifyAnthropicError(new Error("Request timed out."))).toBe("timeout");
    expect(classifyAnthropicError(new DOMException("x", "AbortError"))).toBe("aborted");
    expect(classifyAnthropicError(Object.assign(new Error("x"), { status: 529 }))).toBe("transient");
    expect(classifyAnthropicError(Object.assign(new Error("x"), { status: 413 }))).toBe("too_large");
    expect(classifyAnthropicError(Object.assign(new Error("x"), { status: 401 }))).toBe("fatal");
  });
  it("diğer her şey schema", () => {
    expect(classifyAnthropicError(new SyntaxError("Unexpected token"))).toBe("schema");
    expect(classifyAnthropicError(new Anthropic.AnthropicError("client fault"))).toBe("schema");
    expect(classifyAnthropicError("x")).toBe("schema");
  });
});

describe("summarizeAnthropicError", () => {
  it("≤ 100 karakter; durum, tip ve istek kimliği; ileti gövdesi yok", () => {
    const s = summarizeAnthropicError(new Anthropic.InternalServerError(529, body("overloaded_error"), undefined, h(), "overloaded_error"));
    expect(s).toBe("transient 529 overloaded_error req_011CTestRequestId");
    expect(s.length).toBeLessThanOrEqual(100);
    expect(s).not.toContain("gizli");
    const t = summarizeAnthropicError(new Anthropic.APIConnectionTimeoutError());
    expect(t.startsWith("timeout")).toBe(true);
    expect(summarizeAnthropicError(new Error("x".repeat(500)))).not.toContain("xxx");
    expect(summarizeAnthropicError(new Anthropic.BadRequestError(400, body("invalid_request_error"), "y".repeat(300), h())).length).toBeLessThanOrEqual(100);
  });
});

type Usage = Parameters<typeof readUsage>[0]["usage"];
const usage = (over: Partial<Usage> = {}): Usage => ({
  cache_creation: { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 1150 },
  cache_creation_input_tokens: 1160,
  cache_read_input_tokens: 0,
  fallback_credit: null,
  inference_geo: null,
  input_tokens: 805,
  iterations: null,
  output_tokens: 600,
  output_tokens_details: null,
  server_tool_use: null,
  service_tier: null,
  speed: null,
  ...over,
});

describe("yanıt okuma", () => {
  it("readJsonText ilk text bloğunu seçer (önce thinking gelir)", () => {
    expect(
      readJsonText({
        content: [
          { type: "thinking", thinking: "", signature: "s" },
          { type: "text", text: "{}", citations: null },
          { type: "text", text: "ikinci", citations: null },
        ],
      }).text,
    ).toBe("{}");
    expect(readJsonText({ content: [{ type: "thinking", thinking: "", signature: "s" }] }).text).toBeNull();
    expect(readJsonText({ content: [] }).text).toBeNull();
  });
  it("readUsage: önbellek yazımı TTL'ye göre ayrılır; kırılım yoksa 1 sa sayılır", () => {
    expect(readUsage({ usage: usage() })).toEqual({ input: 805, output: 600, cacheRead: 0, cacheWrite5m: 10, cacheWrite1h: 1150 });
    expect(readUsage({ usage: usage({ cache_creation: null, cache_creation_input_tokens: 300, cache_read_input_tokens: 1150 }) })).toEqual({
      input: 805,
      output: 600,
      cacheRead: 1150,
      cacheWrite5m: 0,
      cacheWrite1h: 300,
    });
    expect(readUsage({ usage: usage({ cache_creation: null, cache_creation_input_tokens: null, cache_read_input_tokens: null }) })).toEqual({
      input: 805,
      output: 600,
      cacheRead: 0,
      cacheWrite5m: 0,
      cacheWrite1h: 0,
    });
  });
  it("servedByFallback yalnız fallback_message yinelemesinde", () => {
    expect(servedByFallback({ usage: usage() })).toBe(false);
    const msgIter = { type: "message" as const, model: "claude-opus-5-5", input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: null };
    expect(servedByFallback({ usage: usage({ iterations: [msgIter] }) })).toBe(false);
    const fb = { ...msgIter, type: "fallback_message" as const, model: "claude-opus-5" };
    expect(servedByFallback({ usage: usage({ iterations: [msgIter, fb] }) })).toBe(true);
  });
});
