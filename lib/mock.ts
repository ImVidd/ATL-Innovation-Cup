import { baselineAnalysis } from "./baseline";
import type { Analysis, Criterion } from "./types";

// Mock mode: deterministic FAKE "AI" results so the app runs without an API key.
// The UI shows a banner whenever these are used.

const INJECTION = /(ignore (the|your|all|previous)|disregard|full marks|give (this|me|it)[^.]*(marks|points|score)|grade this)/i;

export function mockAnalysis(answerText: string, criteria: Criterion[]): Analysis {
  const base = baselineAnalysis(answerText, criteria);
  const statuses = base.results.map((r) => r.status);
  const results = base.results.map((r) => ({
    ...r,
    // Baseline evidence is a keyword list, not a quote, so keep it out of the mock quote field.
    evidence: "",
    note: `[Mock] ${r.note}`,
  }));

  let flag = false;
  let flagReason: string | null = null;
  if (INJECTION.test(answerText)) {
    flag = true;
    flagReason = "Answer contains instructions directed at the grader";
  } else if (answerText.trim().split(/\s+/).length < 15) {
    flag = true;
    flagReason = "Very short answer";
  } else if (statuses.every((s) => s === "not_met")) {
    flag = true;
    flagReason = "Answer may be about a different concept";
  }

  const confidence = flag ? "low" : statuses.includes("partial") ? "medium" : "high";
  return {
    results,
    reason: `[Mock result, not real AI] ${base.reason}`,
    confidence,
    flag,
    flagReason,
  };
}
