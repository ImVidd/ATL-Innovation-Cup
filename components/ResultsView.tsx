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

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-300 text-slate-600">
            <tr>
              <th className="py-2 pr-3">Answer</th>
              <th className="py-2 pr-3">Score</th>
              <th className="py-2 pr-3">Time</th>
              <th className="py-2 pr-3">AI flag</th>
              <th className="py-2 pr-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {session.answers.map((a, i) => (
              <tr key={a.id} className="border-b border-slate-100">
                <td className="py-2 pr-3">
                  <button type="button" className="font-medium underline" onClick={() => onBack(i)}>
                    {a.label}
                  </button>
                </td>
                <td className="py-2 pr-3">{a.finalScore ?? <span className="text-slate-400">not scored</span>}</td>
                <td className="py-2 pr-3 font-mono">{formatSeconds(a.secondsSpent)}</td>
                <td className="py-2 pr-3">{a.analysis?.flag ? `⚠ ${a.analysis.flagReason}` : a.analysisError ? "AI failed" : ""}</td>
                <td className="py-2 pr-3">{a.graderNote}</td>
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
      <p className="text-xs text-slate-500">CSV has answer IDs, scores, time, AI flag and your notes. It does not include answer text.</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
