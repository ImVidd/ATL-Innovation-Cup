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
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Scored" value={`${scored.length} / ${session.answers.length}`} />
        <Stat label="Avg time per answer" value={scored.length ? formatSeconds(avgTime) : "–"} />
        <Stat label="Avg score" value={scored.length ? `${avgScore.toFixed(1)} / ${totalPoints}` : "–"} />
        <Stat label="Flagged by AI" value={String(flagged)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-sunken text-xs text-ink-muted">
            <tr>
              <th className="px-4 py-2 font-semibold">Answer</th>
              <th className="px-4 py-2 font-semibold">Score</th>
              <th className="px-4 py-2 font-semibold">Time</th>
              <th className="px-4 py-2 font-semibold">AI flag</th>
              <th className="px-4 py-2 font-semibold">Note</th>
            </tr>
          </thead>
          <tbody>
            {session.answers.map((a, i) => (
              <tr key={a.id} className="border-t border-line">
                <td className="px-4 py-2.5">
                  <button type="button" className="font-mono font-medium text-primary underline" onClick={() => onBack(i)}>
                    {a.label}
                  </button>
                </td>
                <td className="px-4 py-2.5">{a.finalScore ?? <span className="text-ink-muted">not scored</span>}</td>
                <td className="px-4 py-2.5 font-mono">{formatSeconds(a.secondsSpent)}</td>
                <td className="px-4 py-2.5">{a.analysis?.flag ? `⚠ ${a.analysis.flagReason}` : a.analysisError ? "AI failed" : ""}</td>
                <td className="px-4 py-2.5">{a.graderNote}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={download} className="btn-primary">
          Download CSV
        </button>
        <button type="button" onClick={() => onBack(0)} className="btn-secondary">
          Back to grading
        </button>
      </div>
      <p className="text-xs text-ink-muted">CSV has answer IDs, scores, time, AI flag and your notes. It does not include answer text.</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="text-[28px] leading-8 font-semibold tabular-nums">{value}</div>
    </div>
  );
}
