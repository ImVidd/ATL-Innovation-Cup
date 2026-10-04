import type { Answer } from "./types";

function cell(value: string | number | boolean | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Scores export. Answer text is intentionally left out.
export function toCsv(answers: Answer[], maxPoints: number): string {
  const header = ["answer_id", "final_score", "max_points", "seconds_spent", "ai_flagged", "ai_confidence", "grader_note"];
  const rows = answers.map((a) =>
    [
      a.label,
      a.finalScore ?? "",
      maxPoints,
      Math.round(a.secondsSpent),
      a.analysis ? a.analysis.flag : "",
      a.analysis?.confidence ?? "",
      a.graderNote ?? "",
    ].map(cell).join(","),
  );
  return [header.join(","), ...rows].join("\n") + "\n";
}
