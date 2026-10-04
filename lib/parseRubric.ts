import type { Criterion } from "./types";

export type RubricError = { line: number; text: string; message: string };

export type ParsedRubric = {
  criteria: Criterion[];
  errors: RubricError[];
  totalPoints: number;
};

// Accepted line formats (one criterion per line):
//   "2 | Defines operant conditioning"      (points first)
//   "Names the cause: 2 pts"                (points last)
//   "Names the cause - 2 points" / "Names the cause (2 pts)"
const POINTS_FIRST = /^(\d+(?:\.\d+)?)\s*(?:pts?|points?)?\s*[|:\-–]\s*(.+)$/i;
const POINTS_LAST = /^(.+?)\s*[|:\-–(]\s*(\d+(?:\.\d+)?)\s*(?:pts?|points?)?\s*\)?$/i;

export function parseRubric(text: string): ParsedRubric {
  const criteria: Criterion[] = [];
  const errors: RubricError[] = [];

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;

    let points: number | null = null;
    let description = "";

    const first = line.match(POINTS_FIRST);
    const last = line.match(POINTS_LAST);
    if (first) {
      points = Number(first[1]);
      description = first[2].trim();
    } else if (last) {
      points = Number(last[2]);
      description = last[1].trim();
    }

    if (points === null || !description) {
      errors.push({
        line: index + 1,
        text: line,
        message: 'Could not find a points value. Use "2 | description".',
      });
      return;
    }
    if (!(points > 0)) {
      errors.push({ line: index + 1, text: line, message: "Points must be greater than 0." });
      return;
    }

    criteria.push({ id: `C${criteria.length + 1}`, points, description });
  });

  const totalPoints = criteria.reduce((sum, c) => sum + c.points, 0);
  return { criteria, errors, totalPoints };
}
