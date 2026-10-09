import "server-only";

import { GoogleGenAI } from "@google/genai";
import { ApiError } from "@/lib/api/errors";
import { SCORE_CALL_TIMEOUT_MS, getScoringEnv } from "@/lib/config/scoring";
import { COACH_REPORT_JSON_SCHEMA, CoachReport } from "./reportSchema";
import { SCORE_OUTPUT_JSON_SCHEMA, ScoreOutput } from "./scoreSchema";

// SPEC 14.3 / D18: Gemini varsayılan; arayüz üzerinden fal.ai/OpenAI takılabilir.
// Görsel yalnız bu çağrı süresince bellekte tutulur; loglanmaz, yazılmaz.

export interface ScoringProvider {
  scoreOnce(imageBase64: string, prompt: string, signal?: AbortSignal): Promise<ScoreOutput>;
  readonly model: string;
}

let client: GoogleGenAI | null = null;
function gemini(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new ApiError("AI_FAILED", "Skorlama servisi yapılandırılmamış.");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export class GeminiScoringProvider implements ScoringProvider {
  readonly model = getScoringEnv().scoreModel;

  async scoreOnce(imageBase64: string, prompt: string, signal?: AbortSignal): Promise<ScoreOutput> {
    let text: string | undefined;
    try {
      const res = await gemini().models.generateContent({
        model: this.model,
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: "image/jpeg", data: imageBase64 } }, { text: prompt }] }],
        config: {
          temperature: 0,
          responseMimeType: "application/json",
          responseJsonSchema: SCORE_OUTPUT_JSON_SCHEMA,
          abortSignal: signal,
          httpOptions: { timeout: SCORE_CALL_TIMEOUT_MS },
        },
      });
      text = res.text;
    } catch (e) {
      if (signal?.aborted || (e instanceof Error && /abort|timeout/i.test(e.message))) {
        throw new ApiError("AI_TIMEOUT", "Skorlama zaman aşımına uğradı.");
      }
      throw new ApiError("AI_FAILED", "Skorlama servisi yanıt vermedi.");
    }
    try {
      return ScoreOutput.parse(JSON.parse(text ?? ""));
    } catch {
      throw new ApiError("AI_FAILED", "Skorlama yanıtı şemaya uymadı.");
    }
  }
}

export function getScoringProvider(): ScoringProvider {
  return new GeminiScoringProvider();
}

export type ReportGeneration = { report: unknown; raw: string; inputTokens: number | null; outputTokens: number | null };

export interface ReportProvider {
  readonly model: string;
  /** SPEC 14.3: systemInstruction = REPORT_SYSTEM_V1, temperature 0.4, JSON şema. Ham çıktıyı döndürür; doğrulama çağıranda. */
  generateReport(systemPrompt: string, userMessage: string, signal?: AbortSignal): Promise<ReportGeneration>;
}

export class GeminiReportProvider implements ReportProvider {
  readonly model = process.env.GEMINI_COACH_MODEL || "gemini-3.5-flash-lite";

  async generateReport(systemPrompt: string, userMessage: string, signal?: AbortSignal): Promise<ReportGeneration> {
    try {
      const res = await gemini().models.generateContent({
        model: this.model,
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.4,
          responseMimeType: "application/json",
          responseJsonSchema: COACH_REPORT_JSON_SCHEMA,
          abortSignal: signal,
          httpOptions: { timeout: 45_000 },
        },
      });
      const raw = res.text ?? "";
      let report: unknown = null;
      try {
        report = JSON.parse(raw);
      } catch {
        report = null;
      }
      return { report, raw, inputTokens: res.usageMetadata?.promptTokenCount ?? null, outputTokens: res.usageMetadata?.candidatesTokenCount ?? null };
    } catch (e) {
      if (signal?.aborted || (e instanceof Error && /abort|timeout/i.test(e.message))) throw new ApiError("AI_TIMEOUT", "Rapor üretimi zaman aşımına uğradı.");
      throw new ApiError("AI_FAILED", "Rapor servisi yanıt vermedi.");
    }
  }
}

export function getReportProvider(): ReportProvider {
  return new GeminiReportProvider();
}

export type { CoachReport };
