import { ApiError, GoogleGenAI } from "@google/genai";
import { ANALYSIS_JSON_SCHEMA, extractJson, validateAnalysis } from "./analysis";
import { mockAnalysis } from "./mock";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt";
import type { Analysis, Criterion } from "./types";

// All AI provider code lives here so the provider can be swapped in one place.

const DEFAULT_MODEL = "gemini-flash-latest";
const TIMEOUT_MS = 45_000;

export type AiErrorKind = "rate_limit" | "timeout" | "invalid_output" | "provider";

export class AiError extends Error {
  constructor(public kind: AiErrorKind, message: string) {
    super(message);
  }
}

export function isMockMode(): boolean {
  return process.env.MOCK_AI === "true" || !process.env.GEMINI_API_KEY;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new AiError("timeout", "The AI took too long to respond.")), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

async function callGemini(question: string, criteria: Criterion[], answerText: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
        contents: buildUserMessage(question, criteria, answerText),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.2,
          responseMimeType: "application/json",
          responseJsonSchema: ANALYSIS_JSON_SCHEMA,
        },
      }),
      TIMEOUT_MS,
    );
    return response.text ?? "";
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof ApiError && e.status === 429) {
      throw new AiError("rate_limit", "The AI is busy (free-tier rate limit). Wait a minute and retry.");
    }
    if (e instanceof ApiError && [400, 401, 403].includes(e.status) && /api.?key/i.test(e.message)) {
      throw new AiError("provider", "The server's Gemini API key is invalid. Check GEMINI_API_KEY.");
    }
    const status = e instanceof ApiError ? ` (status ${e.status})` : "";
    throw new AiError("provider", `The AI service returned an error${status}. Try again.`);
  }
}

// Analyze one answer. Invalid model output is retried once before giving up.
export async function analyzeAnswer(
  question: string,
  criteria: Criterion[],
  answerText: string,
): Promise<{ analysis: Analysis; mock: boolean }> {
  if (isMockMode()) {
    return { analysis: mockAnalysis(answerText, criteria), mock: true };
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    const text = await callGemini(question, criteria, answerText);
    try {
      return { analysis: validateAnalysis(extractJson(text), criteria, answerText), mock: false };
    } catch {
      if (attempt === 2) {
        throw new AiError("invalid_output", "The AI returned a response we could not read.");
      }
    }
  }
  throw new AiError("invalid_output", "Unreachable");
}
