"use client";

import { useState } from "react";
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

export default function GradeView({ session, totalPoints, current, elapsedSeconds, onSelect, onSave, onRetry }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [showBaseline, setShowBaseline] = useState(false);
  const answer = session.answers[current];

  const visible = session.answers
    .map((a, index) => ({ a, index }))
    .filter(({ a }) => (filter === "flagged" ? a.analysis?.flag : filter === "unscored" ? !isScored(a) : true));

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <nav aria-label="Answers" className="space-y-2">
        <div className="flex gap-1 text-xs" role="group" aria-label="Filter answers">
          {(["all", "flagged", "unscored"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`min-h-8 rounded border px-2.5 py-1 font-semibold capitalize ${filter === f ? "border-primary bg-primary text-on-primary" : "border-control bg-surface text-ink hover:bg-sunken"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <ul className="flex gap-2 overflow-x-auto md:max-h-[70vh] md:flex-col md:overflow-y-auto">
          {visible.length === 0 && <li className="text-sm text-ink-muted">No answers match.</li>}
          {visible.map(({ a, index }) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={index === current}
                className={`flex min-h-11 w-full min-w-[120px] items-center justify-between gap-2 rounded-md border bg-surface px-3 py-2 text-left font-mono text-sm ${
                  index === current ? "border-2 border-primary bg-surface" : "border-line hover:bg-sunken"
                }`}
              >
                <span className="font-medium">{a.label}</span>
                <span className="flex items-center gap-1 text-xs">
                  {a.analyzing && <span className="text-ink-muted">…</span>}
                  {a.analysisError && <span className="text-danger" title="AI failed">!</span>}
                  {a.analysis?.flag && (
                    <span className="text-flag" title="Needs a closer look">
                      ⚠
                    </span>
                  )}
                  {isScored(a) ? (
                    <span className="rounded bg-met-bg px-1.5 font-mono text-met">{a.finalScore}</span>
                  ) : (
                    <span className="text-ink-muted">–</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-label={`Answer ${answer.label}`} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">
            Answer {answer.label} <span className="font-normal text-ink-muted">({current + 1} of {session.answers.length})</span>
          </h2>
          <span className="rounded bg-sunken px-2 py-1 font-mono text-sm" title="Time spent on this answer">
            ⏱ {formatSeconds(elapsedSeconds)}
          </span>
        </div>

        <div
          className={`card whitespace-pre-wrap px-6 py-5 ${looksLikeCode(answer.text) ? "font-mono text-sm" : "max-w-[68ch] font-serif text-lg leading-[30px]"}`}
        >
          {answer.text}
        </div>

        <AnalysisPanel answer={answer} criteria={session.criteria} showBaseline={showBaseline} onRetry={() => onRetry(answer.id)} />

        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={showBaseline} onChange={(e) => setShowBaseline(e.target.checked)} />
          Compare with simple keyword matching (no AI)
        </label>

        {/* key resets the form when switching answers */}
        <ScoreForm key={answer.id} answer={answer} totalPoints={totalPoints} onSave={onSave} />
      </section>
    </div>
  );
}

function ScoreForm({ answer, totalPoints, onSave }: { answer: Answer; totalPoints: number; onSave: Props["onSave"] }) {
  const [score, setScore] = useState(isScored(answer) ? String(answer.finalScore) : "");
  const [note, setNote] = useState(answer.graderNote ?? "");
  const [error, setError] = useState<string | null>(null);

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
    <form onSubmit={submit} className="space-y-3 rounded-lg border-2 border-primary bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xl font-semibold">Your score</h3>
        <span className="text-xs text-ink-muted">Only you can enter a score.</span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label">Score (0 to {totalPoints})</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0}
            max={totalPoints}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="input w-28 font-mono text-lg"
            autoFocus
          />
        </label>
        <label className="block flex-1">
          <span className="label">Note (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="e.g. example is vague" />
        </label>
      </div>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary">
          Save &amp; next
        </button>
        {isScored(answer) && <span className="text-sm text-met">Saved: {answer.finalScore} / {totalPoints}</span>}
      </div>
    </form>
  );
}
