"use client";

import { useRef, useState } from "react";
import { MAX_ANSWERS, MAX_ANSWER_CHARS } from "@/lib/limits";
import { parseRubric } from "@/lib/parseRubric";
import { ANSWERS_ACCEPT, RUBRIC_ACCEPT, readAnswersFile, readRubricFile, structureRubricText } from "@/lib/readFiles";
import { SAMPLE_ANSWERS, SAMPLE_QUESTION, SAMPLE_RUBRIC } from "@/lib/sampleData";
import { splitAnswers, suggestSplit } from "@/lib/splitAnswers";
import type { Criterion } from "@/lib/types";

export type SetupInput = {
  question: string;
  rubricText: string;
  criteria: Criterion[];
  answerTexts: string[];
};

// When editing a session in progress, the steps start filled in with its current content.
export type SetupInitial = { question: string; rubricText: string; answersText: string };

type Props = {
  onStart: (input: SetupInput) => void;
  initial?: SetupInitial;
  onCancel?: () => void;
};

type FileStatus = { kind: "loading" | "ok" | "error"; message: string } | null;

const STEPS = ["Question", "Rubric", "Answers"] as const;

function StatusLine({ status }: { status: FileStatus }) {
  if (!status) return null;
  const cls = status.kind === "error" ? "text-danger" : status.kind === "ok" ? "text-met" : "text-ink-muted";
  return (
    <p className={`fade-up text-sm ${cls}`} role={status.kind === "error" ? "alert" : "status"}>
      {status.kind === "loading" && (
        <span className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-primary align-[-2px]" aria-hidden />
      )}
      {status.kind === "ok" && "✓ "}
      {status.message}
    </p>
  );
}

// Click or drop a file. The real <input type="file"> is hidden.
function DropZone({ title, hint, accept, onFile, disabled }: { title: string; hint: string; accept: string; onFile: (f: File) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <>
      <button
        type="button"
        className="dropzone"
        data-over={over}
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-primary" aria-hidden>
          <path d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-base font-semibold text-ink">{title}</span>
        <span className="text-sm text-ink-muted">{hint}</span>
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

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="seg-option" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function SetupPanel({ onStart, initial, onCancel }: Props) {
  const editing = Boolean(initial);
  const [step, setStep] = useState(0);
  // Furthest step reached, so the step bar can jump back and forth between filled-in steps.
  const [reached, setReached] = useState(editing ? STEPS.length - 1 : 0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [rubricText, setRubricText] = useState(initial?.rubricText ?? "");
  const [answersText, setAnswersText] = useState(initial?.answersText ?? "");
  const [rubricMode, setRubricMode] = useState<"upload" | "type">(initial?.rubricText ? "type" : "upload");
  const [answersMode, setAnswersMode] = useState<"paste" | "upload">("paste");
  // The grader's own rubric text from before "Structure with AI" replaced it, for Undo.
  const [rubricBeforeAi, setRubricBeforeAi] = useState<string | null>(null);
  const [rubricStatus, setRubricStatus] = useState<FileStatus>(null);
  const [answersStatus, setAnswersStatus] = useState<FileStatus>(null);
  const [triedNext, setTriedNext] = useState(false);

  const rubric = parseRubric(rubricText);
  const answers = splitAnswers(answersText);
  // Answers pasted without "---" between them (blank lines or "Student 1:" labels instead).
  const split = answers.length <= 1 ? suggestSplit(answersText) : null;
  const tooLong = answers.map((a, i) => ({ label: `S${i + 1}`, len: a.length })).filter((a) => a.len > MAX_ANSWER_CHARS);

  const rubricProblems: string[] = [];
  if (rubric.criteria.length === 0 && rubric.errors.length === 0) {
    rubricProblems.push(
      rubric.skipped.length > 0
        ? "No marks found. Use 'Mark | Description' on each line, or let the AI structure it for you."
        : "Add at least one criterion. Use 'Mark | Description' on each line.",
    );
  }
  if (rubric.errors.length > 0) rubricProblems.push("Fix the lines marked below.");

  const answerProblems: string[] = [];
  if (answers.length === 0) answerProblems.push("Add at least one answer.");
  if (answers.length > MAX_ANSWERS) answerProblems.push(`Too many answers: ${MAX_ANSWERS} at most per question.`);
  if (tooLong.length > 0) answerProblems.push(`${tooLong.map((a) => a.label).join(", ")} over ${MAX_ANSWER_CHARS} characters. Shorten or split them.`);

  const stepProblems = step === 1 ? rubricProblems : step === 2 ? answerProblems : [];
  const busy = rubricStatus?.kind === "loading" || answersStatus?.kind === "loading";

  function go(to: number) {
    setDirection(to > step ? "forward" : "back");
    setStep(to);
    setReached((r) => Math.max(r, to));
    setTriedNext(false);
  }

  function next() {
    setTriedNext(true);
    if (stepProblems.length > 0) return;
    if (step < STEPS.length - 1) {
      go(step + 1);
      return;
    }
    onStart({ question: question.trim(), rubricText, criteria: rubric.criteria, answerTexts: answers });
  }

  function useSample() {
    setQuestion(SAMPLE_QUESTION);
    setRubricText(SAMPLE_RUBRIC);
    setAnswersText(SAMPLE_ANSWERS);
    setRubricMode("type");
    setReached(STEPS.length - 1);
    go(1);
  }

  async function uploadRubric(file: File) {
    setRubricStatus({ kind: "loading", message: `Reading ${file.name}…` });
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
    setRubricStatus({ kind: "loading", message: "The AI is structuring your rubric…" });
    try {
      const r = await structureRubricText(original);
      setRubricBeforeAi(original);
      setRubricText(r.rubricText);
      if (r.question && !question.trim()) setQuestion(r.question);
      setRubricStatus({ kind: "ok", message: r.note.replace("Read by AI from your text.", "Structured by the AI.") });
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
    setAnswersStatus({ kind: "loading", message: `Reading ${file.name}…` });
    try {
      const text = await readAnswersFile(file);
      setAnswersText(text);
      setAnswersMode("paste");
      setAnswersStatus({ kind: "ok", message: `Loaded from ${file.name}. Only the answer text is used.` });
    } catch (e) {
      setAnswersStatus({ kind: "error", message: e instanceof Error ? e.message : "Could not read the file." });
    }
  }

  const titles = [
    { title: "Exam question", sub: "The question your students answered." },
    { title: "Rubric", sub: "Upload it, or type one criterion per line as Mark | Description." },
    { title: "Student answers", sub: "Paste or upload them. They become S1, S2… Fake or anonymized answers only." },
  ][step];

  const primaryLabel =
    step < STEPS.length - 1 ? "Continue" : editing ? "Save changes" : `Start grading${answers.length > 0 ? ` ${answers.length} answer${answers.length === 1 ? "" : "s"}` : ""}`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        next();
      }}
      className="mx-auto w-full max-w-2xl"
    >
      {/* Step bar: one segment per step; filled-in steps can be revisited. */}
      <nav aria-label="Setup steps" className="mb-10 flex gap-2">
        {STEPS.map((name, i) => (
          <button
            key={name}
            type="button"
            disabled={i > reached}
            onClick={() => go(i)}
            aria-current={i === step ? "step" : undefined}
            className="group flex flex-1 flex-col gap-2 text-left disabled:cursor-default"
          >
            <span className={`h-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-primary" : "bg-line"}`} />
            <span className={`text-xs font-semibold transition-colors ${i === step ? "text-ink" : i <= reached ? "text-ink-muted group-hover:text-ink" : "text-ink-muted/60"}`}>
              {i + 1}. {name}
            </span>
          </button>
        ))}
      </nav>

      <div key={step} className={direction === "forward" ? "enter-forward" : "enter-back"}>
        <h2 className="text-[40px] leading-[44px] font-semibold tracking-[-0.03em]">{titles.title}</h2>
        <p className="mt-2 text-base text-ink-muted">{titles.sub}</p>

        <div className="mt-8 space-y-4">
          {step === 0 && (
            <>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={4}
                autoFocus
                aria-label="Exam question"
                className="input px-5 py-4 text-xl leading-8"
                placeholder="Explain operant conditioning and give one example."
              />
              {!editing && (
                <p className="text-sm text-ink-muted">
                  Just looking?{" "}
                  <button type="button" onClick={useSample} className="font-semibold text-primary underline-offset-4 hover:underline">
                    Try it with sample answers
                  </button>
                </p>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <Segmented
                label="How to add the rubric"
                value={rubricMode}
                onChange={setRubricMode}
                options={[
                  { value: "upload", label: "Upload a file" },
                  { value: "type", label: "Type it" },
                ]}
              />
              {rubricMode === "upload" ? (
                <DropZone
                  title="Drop your rubric here, or click to choose"
                  hint="PDF, Word, photo, TXT or CSV. The AI turns it into lines you can check."
                  accept={RUBRIC_ACCEPT}
                  onFile={uploadRubric}
                  disabled={busy}
                />
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={rubricText}
                    onChange={(e) => setRubricText(e.target.value)}
                    rows={5}
                    aria-label="Rubric"
                    className="input font-mono text-sm leading-[22px]"
                    placeholder={"2 | Defines operant conditioning\n2 | Gives a correct example\n1 | Mentions reinforcement or punishment"}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-ink-muted">Use &quot;Mark | Description&quot;. &quot;(2 marks)&quot;, headings and tables from Word or Excel work too.</p>
                    <button type="button" className="btn-ghost" onClick={structureRubric} disabled={!rubricText.trim() || busy}>
                      Structure with AI
                    </button>
                  </div>
                </div>
              )}
              <StatusLine status={rubricStatus} />
              {rubricBeforeAi !== null && (
                <button type="button" className="text-sm font-semibold text-primary underline-offset-4 hover:underline" onClick={undoStructure}>
                  Undo: bring back my original text
                </button>
              )}

              {rubric.criteria.length > 0 && (
                <div className="fade-up card overflow-hidden">
                  <ul className="divide-y divide-line">
                    {rubric.criteria.map((c) => (
                      <li key={c.id} className="flex items-baseline justify-between gap-4 px-5 py-3">
                        <span className="text-[15px] leading-6">{c.description}</span>
                        <span className="shrink-0 text-sm text-ink-muted tabular-nums">{c.points} pt{c.points === 1 ? "" : "s"}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-baseline justify-between border-t border-line bg-sunken px-5 py-3">
                    <span className="text-sm font-semibold">Total</span>
                    <span className="text-sm font-semibold tabular-nums">{rubric.totalPoints} pts</span>
                  </div>
                </div>
              )}
              {rubric.skipped.length > 0 && (
                <details className="text-sm text-ink-muted">
                  <summary className="cursor-pointer">
                    {rubric.skipped.length} line{rubric.skipped.length === 1 ? "" : "s"} without a mark skipped
                  </summary>
                  <ul className="mt-2 space-y-1 pl-4">
                    {rubric.skipped.map((s) => (
                      <li key={s.line} className="font-mono text-xs">
                        line {s.line}: {s.text.length > 60 ? `${s.text.slice(0, 60)}…` : s.text}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2">To count one, use &quot;Mark | Description&quot;.</p>
                </details>
              )}
              {rubric.errors.map((err) => (
                <p key={err.line} className="text-sm text-danger" role="alert">
                  Line {err.line} (&quot;{err.text}&quot;): {err.message}
                </p>
              ))}
            </>
          )}

          {step === 2 && (
            <>
              <Segmented
                label="How to add the answers"
                value={answersMode}
                onChange={setAnswersMode}
                options={[
                  { value: "paste", label: "Paste them" },
                  { value: "upload", label: "Upload a file" },
                ]}
              />
              {answersMode === "upload" ? (
                <DropZone
                  title="Drop a file here, or click to choose"
                  hint="TXT with answers separated by ---, or CSV with one answer per row. Name and ID columns are ignored."
                  accept={ANSWERS_ACCEPT}
                  onFile={uploadAnswers}
                  disabled={busy}
                />
              ) : (
                <textarea
                  value={answersText}
                  onChange={(e) => setAnswersText(e.target.value)}
                  rows={9}
                  aria-label="Student answers"
                  className="input text-base leading-7"
                  placeholder={"First answer…\n---\nSecond answer…\n---\nThird answer…"}
                />
              )}
              <StatusLine status={answersStatus} />
              {answersMode === "paste" && !split && (
                <p className="text-xs text-ink-muted">Put a line with only --- between answers, or a blank line and we&apos;ll offer to split them.</p>
              )}
              {answersMode === "paste" && split && (
                <div className="fade-up flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-highlight px-5 py-4" role="status">
                  <p className="text-[15px]">
                    <span className="font-semibold">This looks like {split.length} answers.</span> Split them into S1–S{split.length}?
                  </p>
                  <button type="button" className="btn-primary" onClick={() => setAnswersText(split.join("\n---\n"))}>
                    Split into {split.length}
                  </button>
                </div>
              )}

              {answers.length > 0 && (
                <div className="fade-up card overflow-hidden">
                  <ul className="divide-y divide-line">
                    {answers.slice(0, 5).map((a, i) => (
                      <li key={i} className="flex items-baseline gap-4 px-5 py-3">
                        <span className="w-8 shrink-0 text-sm font-medium text-ink-muted tabular-nums">S{i + 1}</span>
                        <span className="truncate text-[15px]">{a.replace(/\s+/g, " ")}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-line bg-sunken px-5 py-3 text-sm font-semibold">
                    {answers.length} answer{answers.length === 1 ? "" : "s"}
                    {answers.length > 5 && <span className="font-normal text-ink-muted"> · showing the first 5</span>}
                  </div>
                </div>
              )}
            </>
          )}

          {triedNext && stepProblems.length > 0 && (
            <div className="fade-up callout callout-danger flex-col gap-1" role="alert">
              {stepProblems.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-10 flex flex-wrap-reverse items-center justify-between gap-3">
        <div>
          {step > 0 ? (
            <button type="button" className="btn-ghost" onClick={() => go(step - 1)}>
              ← Back
            </button>
          ) : (
            onCancel && (
              <button type="button" className="btn-ghost" onClick={onCancel}>
                Cancel
              </button>
            )
          )}
        </div>
        <div className="flex items-center gap-2">
          {step > 0 && onCancel && (
            <button type="button" className="btn-ghost" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn-primary btn-lg" disabled={busy}>
            {primaryLabel} {step < STEPS.length - 1 && <span aria-hidden>→</span>}
          </button>
        </div>
      </div>
    </form>
  );
}
