"use client";

import { useRef, useState } from "react";
import { MAX_ANSWERS, MAX_ANSWER_CHARS } from "@/lib/limits";
import { parseRubric } from "@/lib/parseRubric";
import { ANSWERS_ACCEPT, RUBRIC_ACCEPT, readAnswersFile, readRubricFile } from "@/lib/readFiles";
import { SAMPLE_ANSWERS, SAMPLE_QUESTION, SAMPLE_RUBRIC } from "@/lib/sampleData";
import { splitAnswers } from "@/lib/splitAnswers";
import type { Criterion } from "@/lib/types";

export type SetupInput = {
  question: string;
  rubricText: string;
  criteria: Criterion[];
  answerTexts: string[];
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

export default function SetupPanel({ onStart }: { onStart: (input: SetupInput) => void }) {
  const [question, setQuestion] = useState("");
  const [rubricText, setRubricText] = useState("");
  const [answersText, setAnswersText] = useState("");
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
    problems.push('Add at least one rubric line, for example "2 | Defines operant conditioning".');
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
          <h2 className="font-serif text-[34px] leading-10 font-semibold tracking-tight">Set up one question</h2>
          <p className="text-sm text-ink-muted">Paste or upload the question, rubric, and typed answers. Answers are labeled S1, S2, ... automatically.</p>
        </div>
        <button type="button" onClick={insertSample} className="btn-secondary">
          Insert sample (fake data)
        </button>
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
          <UploadButton label="Upload rubric (PDF, Word, photo, TXT, CSV)" accept={RUBRIC_ACCEPT} onFile={uploadRubric} disabled={rubricStatus?.kind === "loading"} />
        </div>
        <span className="hint">
          Format: <code>points | description</code>, e.g. <code>2 | Gives a correct example</code>. &quot;Names the cause: 2 pts&quot; also works.
          Uploaded PDFs, photos and Word files are read by AI into this format so you can check and edit them.
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
        {rubric.criteria.length > 0 && (
          <span className="mt-1 block text-sm text-ink-muted">
            {rubric.criteria.length} criteria · {rubric.totalPoints} points total
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

      <button type="submit" className="btn-primary min-h-12 w-full px-6 text-base sm:w-auto">
        Start grading{answers.length > 0 ? ` ${answers.length} answer${answers.length === 1 ? "" : "s"}` : ""}
      </button>
    </form>
  );
}
