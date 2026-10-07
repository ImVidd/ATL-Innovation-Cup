"use client";

import { useRef, useState } from "react";
import { MAX_ANSWERS, MAX_ANSWER_CHARS } from "@/lib/limits";
import { parseRubric } from "@/lib/parseRubric";
import { ANSWERS_ACCEPT, RUBRIC_ACCEPT, readAnswersFile, readRubricFile, structureRubricText } from "@/lib/readFiles";
import { SAMPLE_ANSWERS, SAMPLE_QUESTION, SAMPLE_RUBRIC } from "@/lib/sampleData";
import { splitAnswers } from "@/lib/splitAnswers";
import type { Criterion } from "@/lib/types";

export type SetupInput = {
  question: string;
  rubricText: string;
  criteria: Criterion[];
  answerTexts: string[];
};

// When editing a session in progress, the boxes start filled in with its current content.
export type SetupInitial = { question: string; rubricText: string; answersText: string };

type Props = {
  onStart: (input: SetupInput) => void;
  initial?: SetupInitial;
  onCancel?: () => void;
};

type FileStatus = { kind: "loading" | "ok" | "error"; message: string } | null;

function StatusLine({ status }: { status: FileStatus }) {
  if (!status) return null;
  const cls = status.kind === "error" ? "text-danger" : status.kind === "ok" ? "text-met" : "text-ink-muted";
  return (
    <span className={`mt-1 block text-sm ${cls}`} role={status.kind === "error" ? "alert" : "status"}>
      {status.kind === "loading" && "⏳ "}
      {status.kind === "ok" && "✓ "}
      {status.message}
    </span>
  );
}

// A button that opens a file picker (the real input is hidden).
function UploadButton({ label, accept, onFile, disabled }: { label: string; accept: string; onFile: (f: File) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="btn-secondary !px-3 !py-1 text-xs" onClick={() => input.current?.click()} disabled={disabled}>
        ⬆ {label}
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = ""; // allow re-uploading the same file
        }}
      />
    </>
  );
}

export default function SetupPanel({ onStart, initial, onCancel }: Props) {
  const editing = Boolean(initial);
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [rubricText, setRubricText] = useState(initial?.rubricText ?? "");
  const [answersText, setAnswersText] = useState(initial?.answersText ?? "");
  // The grader's own rubric text from before "Structure with AI" replaced it, for Undo.
  const [rubricBeforeAi, setRubricBeforeAi] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [rubricStatus, setRubricStatus] = useState<FileStatus>(null);
  const [answersStatus, setAnswersStatus] = useState<FileStatus>(null);

  const rubric = parseRubric(rubricText);
  const answers = splitAnswers(answersText);
  const tooLong = answers
    .map((a, i) => ({ label: `S${i + 1}`, len: a.length }))
    .filter((a) => a.len > MAX_ANSWER_CHARS);

  const problems: string[] = [];
  if (rubric.criteria.length === 0 && rubric.errors.length === 0) {
    problems.push(
      rubric.skipped.length > 0
        ? 'No marks found in the rubric. Add a mark to each line, for example "2 | Defines operant conditioning", or click "Structure with AI".'
        : 'Add at least one rubric line, for example "2 | Defines operant conditioning".',
    );
  }
  if (rubric.errors.length > 0) problems.push("Fix the rubric lines marked above.");
  if (answers.length === 0) problems.push("Add at least one student answer.");
  if (answers.length > MAX_ANSWERS) problems.push(`Too many answers: max ${MAX_ANSWERS} per session.`);
  if (tooLong.length > 0) {
    problems.push(`${tooLong.map((a) => a.label).join(", ")} over ${MAX_ANSWER_CHARS} characters. Shorten or split them.`);
  }

  function insertSample() {
    setQuestion(SAMPLE_QUESTION);
    setRubricText(SAMPLE_RUBRIC);
    setAnswersText(SAMPLE_ANSWERS);
  }

  async function uploadRubric(file: File) {
    setRubricStatus({ kind: "loading", message: `Reading ${file.name}...` });
    try {
      const r = await readRubricFile(file);
      setRubricText(r.rubricText);
      if (r.question && !question.trim()) setQuestion(r.question);
      setRubricStatus({ kind: "ok", message: r.note });
    } catch (e) {
      setRubricStatus({ kind: "error", message: e instanceof Error ? e.message : "Could not read the file." });
    }
  }

  async function structureRubric() {
    const original = rubricText;
    setRubricStatus({ kind: "loading", message: "AI is structuring your rubric..." });
    try {
      const r = await structureRubricText(original);
      setRubricBeforeAi(original);
      setRubricText(r.rubricText);
      if (r.question && !question.trim()) setQuestion(r.question);
      setRubricStatus({ kind: "ok", message: r.note.replace("Read by AI from your text.", "Structured by AI.") });
    } catch (e) {
      setRubricStatus({ kind: "error", message: e instanceof Error ? e.message : "Could not structure the rubric." });
    }
  }

  function undoStructure() {
    if (rubricBeforeAi === null) return;
    setRubricText(rubricBeforeAi);
    setRubricBeforeAi(null);
    setRubricStatus(null);
  }

  async function uploadAnswers(file: File) {
    setAnswersStatus({ kind: "loading", message: `Reading ${file.name}...` });
    try {
      const text = await readAnswersFile(file);
      setAnswersText(text);
      setAnswersStatus({ kind: "ok", message: `Loaded from ${file.name}. Only the answer text is used; name or ID columns are ignored.` });
    } catch (e) {
      setAnswersStatus({ kind: "error", message: e instanceof Error ? e.message : "Could not read the file." });
    }
  }

  function start(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (problems.length > 0) return;
    onStart({ question: question.trim(), rubricText, criteria: rubric.criteria, answerTexts: answers });
  }

  return (
    <form onSubmit={start} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-[34px] leading-10 font-semibold tracking-tight">{editing ? "Edit setup" : "Set up one question"}</h2>
          <p className="text-sm text-ink-muted">
            {editing
              ? "Add, remove or fix answers, or correct the rubric. Answers you leave unchanged keep their scores."
              : "Paste or upload the question, rubric, and typed answers. Answers are labeled S1, S2, ... automatically."}
          </p>
        </div>
        {!editing && (
          <button type="button" onClick={insertSample} className="btn-secondary">
            Insert sample (fake data)
          </button>
        )}
      </div>

      <label className="block">
        <span className="label">Exam question</span>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          className="input font-serif text-lg"
          placeholder="e.g. Explain operant conditioning and give one example."
        />
      </label>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="rubric" className="label">
            Rubric (one criterion per line)
          </label>
          <span className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary !px-3 !py-1 text-xs"
              onClick={structureRubric}
              disabled={!rubricText.trim() || rubricStatus?.kind === "loading"}
            >
              Structure with AI
            </button>
            <UploadButton label="Upload rubric (PDF, Word, photo, TXT, CSV)" accept={RUBRIC_ACCEPT} onFile={uploadRubric} disabled={rubricStatus?.kind === "loading"} />
          </span>
        </div>
        <span className="hint">
          Format: <code>Mark | Description</code>, e.g. <code>2 | Gives a correct example</code>. &quot;Gives a correct example (2 marks)&quot; and
          tables pasted from Word or Excel also work. Lines without a mark, such as headings, are skipped. Or describe the marking scheme in
          your own words and click <strong>Structure with AI</strong>; uploaded PDFs, photos and Word files are read the same way. Check the
          result before grading.
        </span>
        <textarea
          id="rubric"
          value={rubricText}
          onChange={(e) => setRubricText(e.target.value)}
          rows={5}
          className="input font-mono text-sm leading-[22px]"
          placeholder={"2 | Defines operant conditioning\n2 | Gives a correct example\n1 | Mentions reinforcement or punishment"}
        />
        <StatusLine status={rubricStatus} />
        {rubricBeforeAi !== null && (
          <button type="button" className="mt-1 block text-sm font-semibold text-primary underline" onClick={undoStructure}>
            Undo: bring back my original text
          </button>
        )}
        {rubric.criteria.length > 0 && (
          <span className="mt-1 block text-sm text-ink-muted">
            {rubric.criteria.length} criteria · {rubric.totalPoints} points total
          </span>
        )}
        {rubric.skipped.length > 0 && (
          <span className="mt-1 block text-sm text-ink-muted" role="status">
            {rubric.skipped.length} line{rubric.skipped.length === 1 ? "" : "s"} without a mark skipped (treated as{" "}
            {rubric.skipped.length === 1 ? "a heading" : "headings"}):{" "}
            {rubric.skipped
              .slice(0, 5)
              .map((s) => `line ${s.line} "${s.text.length > 40 ? `${s.text.slice(0, 40)}…` : s.text}"`)
              .join(", ")}
            {rubric.skipped.length > 5 ? `, and ${rubric.skipped.length - 5} more` : ""}. To count one as a criterion, add a mark, e.g.{" "}
            <code>2 | Description</code>.
          </span>
        )}
        {rubric.errors.map((err) => (
          <span key={err.line} className="mt-1 block text-sm text-danger" role="alert">
            Line {err.line} (&quot;{err.text}&quot;): {err.message}
          </span>
        ))}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="answers" className="label">
            Student answers
          </label>
          <UploadButton label="Upload answers (TXT, CSV)" accept={ANSWERS_ACCEPT} onFile={uploadAnswers} disabled={answersStatus?.kind === "loading"} />
        </div>
        <span className="hint">
          Separate answers with a line containing only <code>---</code>, or upload a CSV with one answer per row. Use fake or anonymized answers only. No names or student IDs.
        </span>
        <textarea
          id="answers"
          value={answersText}
          onChange={(e) => setAnswersText(e.target.value)}
          rows={10}
          className="input font-serif text-[15px] leading-6"
          placeholder={"First answer...\n---\nSecond answer...\n---\nThird answer..."}
        />
        <StatusLine status={answersStatus} />
        <span className="mt-1 block text-sm text-ink-muted">{answers.length} answer{answers.length === 1 ? "" : "s"} detected</span>
      </div>

      {submitted && problems.length > 0 && (
        <ul className="callout callout-danger flex-col gap-1" role="alert">
          {problems.map((p) => (
            <li key={p}>• {p}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary min-h-12 w-full px-6 text-base sm:w-auto">
          {editing ? "Save changes and continue grading" : `Start grading${answers.length > 0 ? ` ${answers.length} answer${answers.length === 1 ? "" : "s"}` : ""}`}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary min-h-12 w-full px-6 text-base sm:w-auto" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
