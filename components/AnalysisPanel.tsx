"use client";

import { baselineAnalysis } from "@/lib/baseline";
import type { Analysis, Answer, Criterion, CriterionStatus } from "@/lib/types";

const STATUS_STYLE: Record<CriterionStatus, { label: string; cls: string }> = {
  met: { label: "Met", cls: "bg-met-bg text-met border-transparent" },
  partial: { label: "Partly met", cls: "bg-partial-bg text-partial border-transparent" },
  not_met: { label: "Missed", cls: "bg-sunken text-ink-muted border-line" },
};

export function StatusBadge({ status }: { status: CriterionStatus }) {
  const s = STATUS_STYLE[status];
  return <span className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

const CONFIDENCE_STYLE = {
  high: "bg-met-bg text-met",
  medium: "bg-partial-bg text-partial",
  low: "bg-flag-bg text-flag",
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
      <div className="card flex items-center gap-2 p-4 text-sm text-ink-muted" aria-live="polite">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-primary" />
        AI is reading this answer against the rubric...
      </div>
    );
  }

  if (answer.analysisError || !answer.analysis) {
    return (
      <div className="callout callout-danger flex-col p-4" role="alert">
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
        <div className="callout callout-flag" role="status">
          <span className="text-flag" aria-hidden>⚠</span>
          <span>
            <span className="font-semibold">Needs a closer look:</span> {a.flagReason}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-ink">AI highlights</span>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${CONFIDENCE_STYLE[a.confidence]}`}>{a.confidence} confidence</span>
        <span className="text-xs text-ink-muted">Suggestions only. You decide the score.</span>
      </div>

      <ul className="card divide-y divide-line">
        {criteria.map((c) => {
          const r = a.results.find((x) => x.criterionId === c.id);
          const b = baseline?.results.find((x) => x.criterionId === c.id);
          return (
            <li key={c.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="text-sm font-semibold">
                  {c.description} <span className="font-normal text-ink-muted">({c.points} pts)</span>
                </span>
                <span className="flex items-center gap-2">
                  {r && <StatusBadge status={r.status} />}
                  {b && (
                    <span className="flex items-center gap-1 text-xs text-ink-muted">
                      keywords: <StatusBadge status={b.status} />
                    </span>
                  )}
                </span>
              </div>
              {r?.evidence && <blockquote className="evidence mt-2">&ldquo;{r.evidence}&rdquo;</blockquote>}
              {r?.note && <p className="mt-1 text-sm text-ink-muted">{r.note}</p>}
              {b && <p className="mt-1 text-xs text-ink-muted">Keyword baseline: {b.note}{b.evidence ? ` (${b.evidence})` : ""}</p>}
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-ink-muted">
        <span className="font-semibold">Summary:</span> {a.reason}
      </p>
    </div>
  );
}
