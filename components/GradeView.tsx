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
              className={`rounded px-2 py-1 capitalize ${filter === f ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <ul className="flex gap-2 overflow-x-auto md:max-h-[70vh] md:flex-col md:overflow-y-auto">
          {visible.length === 0 && <li className="text-sm text-slate-500">No answers match.</li>}
          {visible.map(({ a, index }) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={index === current}
                className={`flex w-full min-w-[120px] items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm ${
                  index === current ? "border-slate-800 bg-slate-50" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="font-medium">{a.label}</span>
                <span className="flex items-center gap-1 text-xs">
                  {a.analyzing && <span className="text-slate-400">…</span>}
                  {a.analysisError && <span className="text-red-600" title="AI failed">!</span>}
                  {a.analysis?.flag && <span title="Needs a closer look">⚠</span>}
                  {isScored(a) ? (
                    <span className="rounded bg-emerald-100 px-1.5 text-emerald-800">{a.finalScore}</span>
                  ) : (
                    <span className="text-slate-400">–</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-label={`Answer ${answer.label}`} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            Answer {answer.label} <span className="font-normal text-slate-500">({current + 1} of {session.answers.length})</span>
          </h2>
          <span className="rounded bg-slate-100 px-2 py-1 font-mono text-sm" title="Time spent on this answer">
            ⏱ {formatSeconds(elapsedSeconds)}
          </span>
        </div>

        <div
          className={`whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-4 leading-relaxed ${looksLikeCode(answer.text) ? "font-mono text-sm" : ""}`}
        >
          {answer.text}
        </div>

        <AnalysisPanel answer={answer} criteria={session.criteria} showBaseline={showBaseline} onRetry={() => onRetry(answer.id)} />

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showBaseline} onChange={(e) => setShowBaseline(e.target.checked)} />
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
    <form onSubmit={submit} className="space-y-3 rounded-md border-2 border-slate-800 p-4">
      <h3 className="font-semibold">Your score</h3>
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
            className="input w-28"
            autoFocus
          />
        </label>
        <label className="block flex-1">
          <span className="label">Note (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="e.g. example is vague" />
        </label>
      </div>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary">
          Save &amp; next
        </button>
        {isScored(answer) && <span className="text-sm text-emerald-700">Saved: {answer.finalScore} / {totalPoints}</span>}
      </div>
    </form>
  );
}
