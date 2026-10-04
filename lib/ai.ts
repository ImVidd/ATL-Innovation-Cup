import { ApiError, GoogleGenAI } from "@google/genai";
import { ANALYSIS_JSON_SCHEMA, extractJson, validateAnalysis } from "./analysis";
import { mockAnalysis } from "./mock";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt";
import type { Analysis, Criterion } from "./types";

// All AI provider code lives here so the provider can be swapped in one place.

// Tried in order. If a model is overloaded (503), rate limited (429) or unknown (404),
// the next one is used. Each Gemini model has its own free-tier quota.
// Override with GEMINI_MODEL (first choice) and GEMINI_FALLBACK_MODELS (comma-separated).
const DEFAULT_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash"];
const CALL_TIMEOUT_MS = 25_000;
const TOTAL_BUDGET_MS = 50_000; // stay under the route's 60s limit

function modelList(): string[] {
  const fallbacks = process.env.GEMINI_FALLBACK_MODELS?.split(",").map((m) => m.trim()).filter(Boolean);
  const list = [process.env.GEMINI_MODEL, ...(fallbacks ?? DEFAULT_MODELS)].filter((m): m is string => Boolean(m));
  return [...new Set(list)];
}

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

// Google's error message is a JSON string; pull out the human-readable part.
// It describes the API problem only, never the answer text.
function providerReason(e: ApiError): string {
  try {
    const parsed = JSON.parse(e.message);
    return String(parsed?.error?.message ?? e.message).slice(0, 200);
  } catch {
    return e.message.slice(0, 200);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGemini(model: string, question: string, criteria: Criterion[], answerText: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await withTimeout(
    ai.models.generateContent({
      model,
      contents: buildUserMessage(question, criteria, answerText),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseJsonSchema: ANALYSIS_JSON_SCHEMA,
      },
    }),
    CALL_TIMEOUT_MS,
  );
  return response.text ?? "";
}

// Calls Gemini, retrying overloads and falling back to the next model when needed.
async function callWithFallback(question: string, criteria: Criterion[], answerText: string): Promise<string> {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let lastError: AiError = new AiError("provider", "The AI service is unavailable. Try again.");

  for (const model of modelList()) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (Date.now() > deadline - 5_000) throw lastError;
      try {
        return await callGemini(model, question, criteria, answerText);
      } catch (e) {
        if (e instanceof AiError) {
          lastError = e; // timeout: try the next model
          break;
        }
        if (!(e instanceof ApiError)) throw new AiError("provider", "Could not reach the AI service. Try again.");

        const reason = providerReason(e);
        console.error(`gemini error model=${model} status=${e.status} reason=${reason}`);
        if ([400, 401, 403].includes(e.status) && /api.?key/i.test(reason)) {
          throw new AiError("provider", "The server's Gemini API key is invalid. Check GEMINI_API_KEY.");
        }
        if (e.status === 429) {
          lastError = new AiError("rate_limit", `The AI is busy (free-tier limit). Wait a minute and retry. [${reason}]`);
          break; // quota is per model, so try the next one
        }
        if (e.status === 404) {
          lastError = new AiError("provider", `AI model not available. [${reason}]`);
          break;
        }
        lastError = new AiError("provider", `The AI service returned an error (${e.status}). Try again. [${reason}]`);
        if (e.status >= 500 && attempt === 1) {
          await sleep(1_500); // overloaded: short wait, then one retry on the same model
          continue;
        }
        break;
      }
    }
  }
  throw lastError;
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
    const text = await callWithFallback(question, criteria, answerText);
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
