"use client";

import { useEffect, useState } from "react";
import { formatSeconds } from "@/lib/format";
import type { Answer, Session } from "@/lib/types";
import AnalysisPanel from "./AnalysisPanel";

type Filter = "all" | "flagged" | "unscored";

type Props = {
  session: Session;
  totalPoints: number;
  current: number;
  elapsedSeconds: number; // timer for the answer on screen
  onSelect: (index: number) => void;
  onSave: (answerId: string, score: number, note: string) => void;
  onRetry: (answerId: string) => void;
};

// Show code answers in a monospace font so indentation is readable.
const looksLikeCode = (text: string) =>
  /^\s*(def |class |import |from \S+ import|#include|public |private |function |const |let |int |print\(|for .*:|while .*:|if .*:)/m.test(text);

const isScored = (a: Answer) => a.finalScore !== null && a.finalScore !== undefined;

// Typing in a field should never switch answers.
const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

export default function GradeView({ session, totalPoints, current, elapsedSeconds, onSelect, onSave, onRetry }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [showBaseline, setShowBaseline] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const answer = session.answers[current];
  const count = session.answers.length;

  function select(index: number) {
    if (index < 0 || index >= count || index === current) return;
    setDirection(index > current ? "forward" : "back");
    onSelect(index);
  }

  // ← and → move between answers.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") select(current + 1);
      if (e.key === "ArrowLeft") select(current - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const visible = session.answers
    .map((a, index) => ({ a, index }))
    .filter(({ a }) => (filter === "flagged" ? a.analysis?.flag : filter === "unscored" ? !isScored(a) : true));

  return (
    <div className="mx-auto w-full max-w-3xl pb-40">
      {/* Answer strip */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Answers" className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 py-1">
          {visible.length === 0 && <span className="px-2 text-sm text-ink-muted">No answers match.</span>}
          {visible.map(({ a, index }) => {
            const active = index === current;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => select(index)}
                aria-current={active}
                title={a.analysis?.flag ? `${a.label}: needs a closer look` : isScored(a) ? `${a.label}: scored ${a.finalScore}` : a.label}
                className={`relative flex h-9 min-w-12 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium tabular-nums transition-all ${
                  active ? "bg-primary text-on-primary" : isScored(a) ? "bg-met-bg text-met hover:brightness-95" : "bg-sunken text-ink hover:bg-line"
                }`}
              >
                {a.label}
                {a.analyzing && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current opacity-60" aria-label="analyzing" />}
                {a.analysis?.flag && !a.analyzing && <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-marker" : "bg-flag"}`} aria-label="flagged" />}
                {a.analysisError && <span className="text-xs text-danger" aria-label="AI failed">!</span>}
              </button>
            );
          })}
        </nav>
        <div className="seg" role="group" aria-label="Filter answers">
          {(
            [
              ["all", "All"],
              ["flagged", "Flagged"],
              ["unscored", "To score"],
            ] as [Filter, string][]
          ).map(([f, label]) => (
            <button key={f} type="button" className="seg-option" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <section key={answer.id} aria-label={`Answer ${answer.label}`} className={direction === "forward" ? "enter-forward" : "enter-back"}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Student answer</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {answer.label} <span className="text-base font-normal text-ink-muted">· {current + 1} of {count}</span>
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-2 rounded-full bg-sunken px-3 py-1 text-sm tabular-nums text-ink-muted" title="Time on this answer">
              ⏱ {formatSeconds(elapsedSeconds)}
            </span>
            <button type="button" className="btn-ghost h-10 w-10 !px-0" onClick={() => select(current - 1)} disabled={current === 0} aria-label="Previous answer">
              ←
            </button>
            <button type="button" className="btn-ghost h-10 w-10 !px-0" onClick={() => select(current + 1)} disabled={current === count - 1} aria-label="Next answer">
              →
            </button>
          </div>
        </div>

        <div
          className={`card whitespace-pre-wrap px-7 py-6 ${looksLikeCode(answer.text) ? "font-mono text-sm leading-6" : "text-[19px] leading-8"}`}
        >
          {answer.text}
        </div>

        <div className="mt-8">
          <AnalysisPanel answer={answer} criteria={session.criteria} showBaseline={showBaseline} onRetry={() => onRetry(answer.id)} />
          {answer.analysis && (
            <button type="button" className="btn-ghost mt-3 -ml-4" onClick={() => setShowBaseline((v) => !v)} aria-pressed={showBaseline}>
              {showBaseline ? "Hide keyword comparison" : "Compare with simple keyword matching"}
            </button>
          )}
        </div>
      </section>

      {/* key resets the form when switching answers */}
      <ScoreBar key={`score-${answer.id}`} answer={answer} totalPoints={totalPoints} onSave={onSave} />
    </div>
  );
}

const roundHalf = (n: number) => Math.round(n * 2) / 2;

// The score bar sits at the bottom of the screen, like a checkout bar. Only the grader fills it in.
function ScoreBar({ answer, totalPoints, onSave }: { answer: Answer; totalPoints: number; onSave: Props["onSave"] }) {
  const [score, setScore] = useState(isScored(answer) ? String(answer.finalScore) : "");
  const [note, setNote] = useState(answer.graderNote ?? "");
  const [error, setError] = useState<string | null>(null);

  function step(delta: number) {
    const now = score.trim() === "" || Number.isNaN(Number(score)) ? (delta > 0 ? -delta : totalPoints - delta) : Number(score);
    setScore(String(Math.min(totalPoints, Math.max(0, roundHalf(now + delta)))));
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(score);
    if (score.trim() === "" || Number.isNaN(value) || value < 0 || value > totalPoints) {
      setError(`Enter a score from 0 to ${totalPoints}.`);
      return;
    }
    setError(null);
    onSave(answer.id, value, note.trim());
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
      <form
        onSubmit={submit}
        className="pointer-events-auto mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/95 p-2.5 shadow-float backdrop-blur sm:gap-3 sm:p-3"
      >
        <div className="flex items-center gap-1 rounded-full bg-sunken p-1">
          <button type="button" className="h-9 w-9 rounded-full text-lg text-ink-muted transition-colors hover:bg-surface hover:text-ink" onClick={() => step(-0.5)} aria-label="Lower score by half a point">
            −
          </button>
          <input
            value={score}
            onChange={(e) => {
              setScore(e.target.value);
              setError(null);
            }}
            inputMode="decimal"
            aria-label={`Your score, 0 to ${totalPoints}`}
            placeholder="–"
            autoFocus
            className="h-9 w-14 rounded-full bg-surface text-center text-lg font-semibold tabular-nums text-ink outline-none placeholder:text-ink-muted"
          />
          <button type="button" className="h-9 w-9 rounded-full text-lg text-ink-muted transition-colors hover:bg-surface hover:text-ink" onClick={() => step(0.5)} aria-label="Raise score by half a point">
            +
          </button>
        </div>
        <span className="text-sm text-ink-muted tabular-nums">/ {totalPoints}</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label="Note (optional)"
          placeholder="Add a note (optional)"
          className="order-last h-10 w-full rounded-full border border-transparent bg-sunken px-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-control focus:bg-surface sm:order-none sm:h-11 sm:w-auto sm:min-w-40 sm:flex-1"
        />
        <button type="submit" className="btn-primary btn-lg !min-h-11 ml-auto !px-5 sm:ml-0 sm:!px-7">
          <span className="sm:hidden">Save</span>
          <span className="hidden sm:inline">Save &amp; next</span> <span aria-hidden>→</span>
        </button>
        {error && (
          <p className="fade-up order-last w-full px-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        {!error && (
          <p className="hidden w-full px-2 text-xs text-ink-muted sm:block">
            {isScored(answer) ? `Saved: ${answer.finalScore} / ${totalPoints}. Change it and save again anytime.` : "Only you enter the score. The AI never fills it in."}
          </p>
        )}
      </form>
    </div>
  );
}
