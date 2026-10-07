// Browser-side file reading for the setup screen.
import { answersFromCsv, criteriaToRubricText, rubricTextFromCsv } from "./fileImport";
import { MAX_RUBRIC_FILE_BYTES } from "./limits";
import { parseRubric } from "./parseRubric";

export const RUBRIC_ACCEPT = ".txt,.md,.csv,.docx,.pdf,.png,.jpg,.jpeg,.webp";
export const ANSWERS_ACCEPT = ".txt,.csv";

export type RubricFileResult = { rubricText: string; question: string; note: string };

const extOf = (name: string) => name.toLowerCase().split(".").pop() ?? "";

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

async function askAi(body: object, fileName: string): Promise<RubricFileResult> {
  const res = await fetch("/api/extract-rubric", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Could not read ${fileName}.`);
  if (!data.criteria?.length) throw new Error(`No rubric found in ${fileName}. ${data.notes ?? ""}`.trim());
  return {
    rubricText: criteriaToRubricText(data.criteria),
    question: data.question ?? "",
    note: `Read by AI from ${fileName}. Check every line before grading.${data.notes ? ` AI note: ${data.notes}` : ""}`,
  };
}

// Text that already looks like "points | description" lines is used as-is; anything else
// (a Word table, free-form text) goes to the AI to be turned into rubric lines.
async function fromText(text: string, fileName: string): Promise<RubricFileResult> {
  const parsed = parseRubric(text);
  if (parsed.criteria.length > 0 && parsed.errors.length === 0 && parsed.skipped.length <= parsed.criteria.length) {
    return { rubricText: text.trim().replace(/\n\s*\n/g, "\n"), question: "", note: `Loaded from ${fileName}.` };
  }
  return askAi({ text: text.slice(0, 20_000) }, fileName);
}

export async function readRubricFile(file: File): Promise<RubricFileResult> {
  if (file.size > MAX_RUBRIC_FILE_BYTES) {
    throw new Error(`File is too large (max ${MAX_RUBRIC_FILE_BYTES / 1_000_000} MB).`);
  }
  const ext = extOf(file.name);
  if (ext === "txt" || ext === "md") return fromText(await file.text(), file.name);
  if (ext === "csv") {
    const csvText = await file.text();
    const lines = rubricTextFromCsv(csvText);
    return lines ? { rubricText: lines, question: "", note: `Loaded from ${file.name}.` } : fromText(csvText, file.name);
  }
  if (ext === "docx") {
    const { default: mammoth } = await import("mammoth");
    let value: string;
    try {
      ({ value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() }));
    } catch {
      throw new Error(`Could not read ${file.name}. Re-save it as .docx (not .doc) or as a PDF.`);
    }
    return fromText(value, file.name);
  }
  const mimeByExt: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };
  if (mimeByExt[ext]) return askAi({ mimeType: mimeByExt[ext], dataBase64: await toBase64(file) }, file.name);
  throw new Error("Unsupported file type. Use PDF, Word (.docx), a photo, TXT or CSV.");
}

// The rubric box's "Structure with AI" button: turns whatever the grader typed or pasted
// (a description of the marking scheme, a messy table) into rubric lines.
export function structureRubricText(text: string): Promise<RubricFileResult> {
  return askAi({ text: text.slice(0, 20_000) }, "your text");
}

// Answers file: .txt (answers separated by ---) or .csv (one answer per row).
export async function readAnswersFile(file: File): Promise<string> {
  const ext = extOf(file.name);
  const text = await file.text();
  if (ext === "csv") {
    const answers = answersFromCsv(text);
    if (answers.length === 0) throw new Error(`No answers found in ${file.name}.`);
    return answers.join("\n---\n");
  }
  if (ext === "txt") return text;
  throw new Error("Use a .txt file (answers separated by ---) or a .csv file (one answer per row).");
}
