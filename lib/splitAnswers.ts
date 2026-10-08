// Answers are pasted into one box, separated by a line containing only "---".
// Empty answers (e.g. from a trailing "---") are dropped.
export function splitAnswers(text: string): string[] {
  return text
    .split(/^\s*-{3,}\s*$/m)
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

// Labels people type before each answer: "Student 1:", "Answer 2.", "S3)", "#4 -", "Response 5".
const ANSWER_LABEL = /^\s*(?:(?:student|answer|response|submission|s)\s*#?\s*\d+|#\s*\d+)\s*[:.)\-–]?\s*/i;

// When no "---" separators were typed, guess where one answer ends and the next begins,
// so the grader can split them with one click. Returns null when there is nothing to split.
export function suggestSplit(text: string): string[] | null {
  if (/^\s*-{3,}\s*$/m.test(text)) return null;
  const lines = text.split(/\r?\n/);

  // 1. Labeled answers: split at each labeled line and drop the label.
  if (lines.filter((l) => ANSWER_LABEL.test(l) && /\d/.test(l.slice(0, 20))).length >= 2) {
    const parts: string[] = [];
    for (const line of lines) {
      if (ANSWER_LABEL.test(line) && /\d/.test(line.slice(0, 20))) parts.push(line.replace(ANSWER_LABEL, ""));
      else if (parts.length > 0) parts[parts.length - 1] += `\n${line}`;
      else parts.push(line);
    }
    const cleaned = parts.map((p) => p.trim()).filter(Boolean);
    if (cleaned.length >= 2) return cleaned;
  }

  // 2. Blank lines between answers.
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks.length >= 2 ? blocks : null;
}
