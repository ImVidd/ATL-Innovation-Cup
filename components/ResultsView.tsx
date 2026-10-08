"use client";

import { toCsv } from "@/lib/csv";
import { formatSeconds } from "@/lib/format";
import type { Session } from "@/lib/types";

type Props = { session: Session; totalPoints: number; onBack: (index: number) => void };

export default function ResultsView({ session, totalPoints, onBack }: Props) {
  const scored = session.answers.filter((a) => a.finalScore !== null && a.finalScore !== undefined);
  const flagged = session.answers.filter((a) => a.analysis?.flag).length;
  const avgTime = scored.length ? scored.reduce((s, a) => s + a.secondsSpent, 0) / scored.length : 0;
  const avgScore = scored.length ? scored.reduce((s, a) => s + (a.finalScore ?? 0), 0) / scored.length : 0;
  const allDone = scored.length === session.answers.length;
  const firstUnscored = session.answers.findIndex((a) => a.finalScore === null || a.finalScore === undefined);

  function download() {
    const blob = new Blob([toCsv(session.answers, totalPoints)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "scores.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="enter-forward mx-auto w-full max-w-3xl">
      <div className="text-center">
        {allDone && (
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-met-bg text-met" aria-hidden>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M5 12.5 10 17.5 19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        <h2 className="font-serif text-[40px] leading-[46px] font-semibold tracking-tight">
          {allDone ? "The whole set is graded." : `${scored.length} of ${session.answers.length} scored`}
        </h2>
        <p className="mt-2 text-base text-ink-muted">
          {allDone ? "Download the scores for your gradebook." : "Finish the rest, or download what you have so far."}
        </p>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Scored" value={`${scored.length}/${session.answers.length}`} />
        <Stat label="Avg time" value={scored.length ? formatSeconds(avgTime) : "–"} />
        <Stat label="Avg score" value={scored.length ? `${avgScore.toFixed(1)}/${totalPoints}` : "–"} />
        <Stat label="Flagged" value={String(flagged)} />
      </div>

      <ul className="card mt-8 divide-y divide-line">
        {session.answers.map((a, i) => (
          <li key={a.id}>
            <button type="button" onClick={() => onBack(i)} className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-sunken">
              <span className="w-10 shrink-0 font-mono text-sm">{a.label}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
                {a.analysis?.flag ? <span className="text-flag">⚠ {a.analysis.flagReason}</span> : a.analysisError ? "AI failed" : a.graderNote}
              </span>
              <span className="shrink-0 font-mono text-xs text-ink-muted tabular-nums">{formatSeconds(a.secondsSpent)}</span>
              <span className={`w-16 shrink-0 text-right font-mono text-sm tabular-nums ${a.finalScore === null || a.finalScore === undefined ? "text-ink-muted" : "text-ink"}`}>
                {a.finalScore ?? "–"}
                <span className="text-ink-muted">/{totalPoints}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={download} className="btn-primary btn-lg">
          Download CSV
        </button>
        {!allDone && (
          <button type="button" onClick={() => onBack(firstUnscored === -1 ? 0 : firstUnscored)} className="btn-ghost">
            Keep grading →
          </button>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-ink-muted">The CSV has answer IDs, scores, time, flags and your notes. No answer text.</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-sunken px-4 py-4 text-center">
      <div className="font-mono text-[26px] leading-8 font-medium tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-ink-muted">{label}</div>
    </div>
  );
}
