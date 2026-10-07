import type { Criterion } from "./types";

export type RubricError = { line: number; text: string; message: string };
export type SkippedLine = { line: number; text: string };

export type ParsedRubric = {
  criteria: Criterion[];
  errors: RubricError[];
  // Lines with no mark (headings, notes). Skipped, but reported so a forgotten mark can be spotted.
  skipped: SkippedLine[];
  totalPoints: number;
};

// Accepted line formats (one criterion per line):
//   "2 | Defines operant conditioning"                  (mark first)
//   "(2 marks) Defines operant conditioning"            (mark first, in brackets)
//   "Names the cause: 2 pts" / "Names the cause - 2 points"
//   "Names the cause (2 marks)" / "Names the cause [2]" / "Names the cause 2 marks"
//   A table row pasted from Word or Excel (cells separated by tabs), or a Markdown table row.
// Lines with no mark at all are treated as headings and skipped.
const NUM = "(\\d+(?:\\.\\d+)?)";
const UNIT = "(?:pts?|points?|marks?)";
const POINTS_FIRST = new RegExp(`^${NUM}\\s*${UNIT}?\\s*[|:\\-–]\\s*(.+)$`, "i");
const POINTS_BRACKET_FIRST = new RegExp(`^[(\\[]\\s*${NUM}\\s*${UNIT}?\\s*[)\\]]\\s*[|:\\-–]?\\s*(.+)$`, "i");
const POINTS_LAST = new RegExp(`^(.+?)\\s*[|:\\-–(\\[]\\s*${NUM}\\s*${UNIT}?\\s*[)\\]]?$`, "i");
const POINTS_LAST_UNIT = new RegExp(`^(.+?)\\s+${NUM}\\s*${UNIT}$`, "i");
const POINTS_CELL = new RegExp(`^[(\\[]?\\s*${NUM}\\s*${UNIT}?\\s*[)\\]]?$`, "i");
const TABLE_RULE = /^[\s|:\-–]+$/; // e.g. the "|---|---|" line of a Markdown table

type Found = { points: number; description: string } | null;

function parseTextLine(line: string): Found {
  const first = line.match(POINTS_FIRST) ?? line.match(POINTS_BRACKET_FIRST);
  if (first) return { points: Number(first[1]), description: first[2].trim() };
  const last = line.match(POINTS_LAST) ?? line.match(POINTS_LAST_UNIT);
  if (last) return { points: Number(last[2]), description: last[1].trim() };
  return null;
}

// A table row: one cell holds the mark, the other cells are the description.
function parseTableRow(line: string): Found {
  const cells = line
    .split(/[\t|]/)
    .map((c) => c.trim())
    .filter(Boolean);
  const isMark = (c: string) => POINTS_CELL.test(c);
  const markIndex = isMark(cells[0] ?? "") ? 0 : cells.findLastIndex(isMark);
  if (markIndex === -1) return null;
  const description = cells.filter((_, i) => i !== markIndex).join(" - ");
  return { points: Number(cells[markIndex].match(POINTS_CELL)![1]), description };
}

export function parseRubric(text: string): ParsedRubric {
  const criteria: Criterion[] = [];
  const errors: RubricError[] = [];
  const skipped: SkippedLine[] = [];

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || TABLE_RULE.test(line)) return;

    const isTableRow = line.includes("\t") || line.startsWith("|");
    const found = isTableRow ? parseTableRow(line) : parseTextLine(line);

    if (!found || !found.description) {
      skipped.push({ line: index + 1, text: line });
      return;
    }
    if (!(found.points > 0)) {
      errors.push({ line: index + 1, text: line, message: "The mark must be greater than 0." });
      return;
    }

    criteria.push({ id: `C${criteria.length + 1}`, points: found.points, description: found.description });
  });

  const totalPoints = criteria.reduce((sum, c) => sum + c.points, 0);
  return { criteria, errors, skipped, totalPoints };
}
