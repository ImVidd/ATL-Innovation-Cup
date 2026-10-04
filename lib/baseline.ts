import type { Analysis, Criterion, CriterionResult, CriterionStatus } from "./types";

// Non-AI baseline: a plain keyword matcher. Used to check whether the AI adds
// value over something simple, and as the base of mock mode.

const STOPWORDS = new Set([
  "about", "above", "after", "again", "also", "because", "been", "before", "being", "between",
  "both", "but", "does", "each", "from", "have", "having", "here", "into", "itself", "just",
  "more", "most", "only", "other", "over", "same", "should", "some", "such", "than", "that",
  "their", "them", "then", "there", "these", "they", "this", "those", "through", "under",
  "very", "what", "when", "where", "which", "while", "with", "would", "your",
  // Rubric "instruction" words that say what to do, not what the content is.
  "defines", "define", "gives", "give", "mentions", "mention", "explains", "explain",
  "describes", "describe", "names", "name", "states", "state", "identifies", "identify",
  "lists", "list", "provides", "provide", "correct", "correctly", "least", "uses",
]);

export function keywordsFor(description: string): string[] {
  const words = description.toLowerCase().match(/[a-z]+/g) ?? [];
  return [...new Set(words.filter((w) => w.length >= 4 && !STOPWORDS.has(w)))];
}

// Loose match so "consequence" matches "consequences" and "reinforce" matches "reinforcement".
function containsKeyword(answerWords: string[], keyword: string): boolean {
  const stem = keyword.slice(0, Math.max(4, keyword.length - 3));
  return answerWords.some((w) => w.startsWith(stem));
}

export function statusForRatio(ratio: number): CriterionStatus {
  if (ratio >= 0.6) return "met";
  if (ratio >= 0.3) return "partial";
  return "not_met";
}

export function baselineAnalysis(answerText: string, criteria: Criterion[]): Analysis {
  const answerWords = answerText.toLowerCase().match(/[a-z]+/g) ?? [];

  const results: CriterionResult[] = criteria.map((c) => {
    const keywords = keywordsFor(c.description);
    if (keywords.length === 0) {
      return { criterionId: c.id, status: "not_met", evidence: "", note: "No keywords to match." };
    }
    const found = keywords.filter((k) => containsKeyword(answerWords, k));
    const ratio = found.length / keywords.length;
    return {
      criterionId: c.id,
      status: statusForRatio(ratio),
      evidence: found.join(", "),
      note: `Matched ${found.length} of ${keywords.length} keywords.`,
    };
  });

  const met = results.filter((r) => r.status === "met").length;
  return {
    results,
    reason: `Keyword match: ${met} of ${criteria.length} criteria matched.`,
    confidence: "low",
    flag: false,
    flagReason: null,
  };
}
