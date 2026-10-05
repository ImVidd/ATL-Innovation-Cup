// Turning uploaded files into the same text the setup boxes use.
// Pure functions (no browser APIs) so they can be unit tested.

// Minimal CSV parser: handles quoted cells, "" escapes, commas and newlines inside quotes.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

const isNumber = (s: string) => /^\d+(\.\d+)?$/.test(s.replace(/\s*(pts?|points?)$/i, ""));
const toNumber = (s: string) => Number(s.replace(/\s*(pts?|points?)$/i, ""));

// Rubric CSV: each row has a points cell and a description, in either order. Header rows are skipped.
export function rubricTextFromCsv(text: string): string {
  return parseCsv(text)
    .map((row) => {
      const pointsIndex = row.findIndex(isNumber);
      if (pointsIndex === -1) return null; // header or junk row
      const description = row.filter((_, i) => i !== pointsIndex && row[i] !== "").join(" - ");
      return description ? `${toNumber(row[pointsIndex])} | ${description}` : null;
    })
    .filter((line): line is string => line !== null)
    .join("\n");
}

// Answers CSV: uses a column named like "answer" / "response" / "text" if there is one,
// otherwise the first column. Other columns (e.g. names or IDs) are ignored on purpose.
export function answersFromCsv(text: string): string[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  // Only short, header-like cells count ("answer", "Student Response", "answer_text"), not answers that contain the word.
  const isAnswerHeader = (h: string) =>
    /^(student |final |your )?(answer|response|submission|text)s?( text)?$/.test(h.toLowerCase().replace(/[_-]/g, " ").trim());
  const named = rows[0].findIndex(isAnswerHeader);
  const column = named === -1 ? 0 : named;
  const body = named === -1 ? rows : rows.slice(1);
  return body.map((r) => (r[column] ?? "").trim()).filter(Boolean);
}

export function criteriaToRubricText(criteria: { points: number; description: string }[]): string {
  return criteria.map((c) => `${c.points} | ${c.description.replace(/\s+/g, " ").trim()}`).join("\n");
}
