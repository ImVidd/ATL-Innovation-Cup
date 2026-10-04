// Answers are pasted into one box, separated by a line containing only "---".
// Empty answers (e.g. from a trailing "---") are dropped.
export function splitAnswers(text: string): string[] {
  return text
    .split(/^\s*-{3,}\s*$/m)
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}
