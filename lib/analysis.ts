import { z } from "zod";
import type { Analysis, Criterion } from "./types";

// Validates and cleans up model output. Anything the model gets wrong in a way
// we can't safely repair throws, so the caller can retry once.

const resultSchema = z.object({
  criterionId: z.string(),
  status: z.enum(["met", "partial", "not_met"]),
  evidence: z.string(),
  note: z.string(),
});

const analysisSchema = z.object({
  results: z.array(resultSchema),
  reason: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  flag: z.boolean(),
  flagReason: z.string().nullable(),
});

const MAX_EVIDENCE_WORDS = 25;

// Lowercase and strip punctuation so small formatting differences in a quote still match.
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Pull the first {...} block out of a response, in case the model wraps it in text or ```json.
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model output");
  return JSON.parse(text.slice(start, end + 1));
}

export function validateAnalysis(raw: unknown, criteria: Criterion[], answerText: string): Analysis {
  const parsed = analysisSchema.parse(raw);

  const byId = new Map(parsed.results.map((r) => [r.criterionId, r]));
  const missing = criteria.filter((c) => !byId.has(c.id));
  if (missing.length > 0) {
    throw new Error(`Model output missing criteria: ${missing.map((c) => c.id).join(", ")}`);
  }

  const answerNorm = normalize(answerText);
  let unverifiedQuote = false;

  // Keep only real criteria, in rubric order, and check each quote really is in the answer.
  const results = criteria.map((c) => {
    const r = byId.get(c.id)!;
    let evidence = r.evidence.trim().split(/\s+/).slice(0, MAX_EVIDENCE_WORDS).join(" ");
    let note = r.note.trim();
    if (evidence && !answerNorm.includes(normalize(evidence))) {
      unverifiedQuote = true;
      evidence = "";
      note = `${note} (The AI's quote could not be found in the answer.)`.trim();
    }
    return { criterionId: c.id, status: r.status, evidence, note };
  });

  // Rules that always flag, even if the model forgot to:
  // low confidence, a made-up quote, or an answer that meets nothing (often off-topic).
  const nothingMet = results.every((r) => r.status === "not_met");
  const flag = parsed.flag || parsed.confidence === "low" || unverifiedQuote || nothingMet;
  let flagReason = parsed.flagReason?.trim() || null;
  if (flag && !flagReason) {
    flagReason = unverifiedQuote
      ? "AI quoted text that is not in the answer"
      : nothingMet
        ? "No rubric criteria met: may be off-topic or a misconception. Read it closely"
        : "AI is unsure about this answer";
  }
  if (!flag) flagReason = null;

  return { results, reason: parsed.reason.trim(), confidence: parsed.confidence, flag, flagReason };
}

// JSON schema handed to Gemini so it returns structured output.
export const ANALYSIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          criterionId: { type: "string" },
          status: { type: "string", enum: ["met", "partial", "not_met"] },
          evidence: { type: "string" },
          note: { type: "string" },
        },
        required: ["criterionId", "status", "evidence", "note"],
      },
    },
    reason: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    flag: { type: "boolean" },
    flagReason: { type: ["string", "null"] },
  },
  required: ["results", "reason", "confidence", "flag", "flagReason"],
};
