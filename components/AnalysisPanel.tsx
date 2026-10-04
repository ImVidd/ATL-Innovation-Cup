"use client";

import { baselineAnalysis } from "@/lib/baseline";
import type { Analysis, Answer, Criterion, CriterionStatus } from "@/lib/types";

const STATUS_STYLE: Record<CriterionStatus, { label: string; cls: string }> = {
  met: { label: "Met", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  partial: { label: "Partly met", cls: "bg-amber-100 text-amber-900 border-amber-300" },
  not_met: { label: "Missed", cls: "bg-slate-100 text-slate-700 border-slate-300" },
};

export function StatusBadge({ status }: { status: CriterionStatus }) {
  const s = STATUS_STYLE[status];
  return <span className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

const CONFIDENCE_STYLE = {
  high: "bg-emerald-50 text-emerald-800",
  medium: "bg-amber-50 text-amber-900",
  low: "bg-red-50 text-red-800",
};

type Props = {
  answer: Answer;
  criteria: Criterion[];
  showBaseline: boolean;
  onRetry: () => void;
};

export default function AnalysisPanel({ answer, criteria, showBaseline, onRetry }: Props) {
  if (answer.analyzing) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-slate-200 p-4 text-sm text-slate-600" aria-live="polite">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        AI is reading this answer against the rubric...
      </div>
    );
  }

  if (answer.analysisError || !answer.analysis) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800" role="alert">
        <p className="font-medium">{answer.analysisError ? "AI analysis failed for this answer." : "Not analyzed yet."}</p>
        {answer.analysisError && <p className="mt-1">{answer.analysisError}</p>}
        <p className="mt-1">You can still read the answer and score it yourself.</p>
        <button type="button" onClick={onRetry} className="btn-secondary mt-3">
          {answer.analysisError ? "Retry AI analysis" : "Run AI analysis"}
        </button>
      </div>
    );
  }

  const a: Analysis = answer.analysis;
  const baseline = showBaseline ? baselineAnalysis(answer.text, criteria) : null;

  return (
    <div className="space-y-3">
      {a.flag && (
        <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900" role="status">
          <span className="font-semibold">⚠ Needs a closer look:</span> {a.flagReason}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-slate-700">AI highlights</span>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${CONFIDENCE_STYLE[a.confidence]}`}>{a.confidence} confidence</span>
        <span className="text-xs text-slate-500">Suggestions only. You decide the score.</span>
      </div>

      <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
        {criteria.map((c) => {
          const r = a.results.find((x) => x.criterionId === c.id);
          const b = baseline?.results.find((x) => x.criterionId === c.id);
          return (
            <li key={c.id} className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="text-sm font-medium">
                  {c.description} <span className="font-normal text-slate-500">({c.points} pts)</span>
                </span>
                <span className="flex items-center gap-2">
                  {r && <StatusBadge status={r.status} />}
                  {b && (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      keywords: <StatusBadge status={b.status} />
                    </span>
                  )}
                </span>
              </div>
              {r?.evidence && <blockquote className="mt-2 border-l-4 border-sky-300 bg-sky-50 px-3 py-1 text-sm italic">&ldquo;{r.evidence}&rdquo;</blockquote>}
              {r?.note && <p className="mt-1 text-sm text-slate-600">{r.note}</p>}
              {b && <p className="mt-1 text-xs text-slate-500">Keyword baseline: {b.note}{b.evidence ? ` (${b.evidence})` : ""}</p>}
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-slate-700">
        <span className="font-medium">Summary:</span> {a.reason}
      </p>
    </div>
  );
}
