"use client";

import { baselineAnalysis } from "@/lib/baseline";
import type { Analysis, Answer, Criterion, CriterionStatus } from "@/lib/types";

const STATUS_STYLE: Record<CriterionStatus, { label: string; cls: string }> = {
  met: { label: "Met", cls: "bg-met-bg text-met" },
  partial: { label: "Partly met", cls: "bg-partial-bg text-partial" },
  not_met: { label: "Missed", cls: "bg-sunken text-ink-muted" },
};

export function StatusBadge({ status }: { status: CriterionStatus }) {
  const s = STATUS_STYLE[status];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

const CONFIDENCE_TEXT = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
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
      <div className="fade-up space-y-3" aria-live="polite">
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-primary" aria-hidden />
          The AI is reading this answer against the rubric…
        </p>
        <div className="card divide-y divide-line">
          {criteria.slice(0, 3).map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <span className="h-3 w-2/3 animate-pulse rounded-full bg-sunken" />
              <span className="h-5 w-16 animate-pulse rounded-full bg-sunken" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (answer.analysisError || !answer.analysis) {
    return (
      <div className="fade-up card flex flex-wrap items-center justify-between gap-4 px-5 py-4" role="alert">
        <div>
          <p className="font-semibold">{answer.analysisError ? "The AI couldn't read this answer." : "Not analyzed yet."}</p>
          <p className="mt-0.5 text-sm text-ink-muted">{answer.analysisError ? `${answer.analysisError} You can still score it yourself.` : "You can still score it yourself."}</p>
        </div>
        <button type="button" onClick={onRetry} className="btn-secondary rounded-full">
          {answer.analysisError ? "Try again" : "Run the AI"}
        </button>
      </div>
    );
  }

  const a: Analysis = answer.analysis;
  const baseline = showBaseline ? baselineAnalysis(answer.text, criteria) : null;

  return (
    <div className="fade-up space-y-4">
      {a.flag && (
        <div className="callout callout-flag" role="status">
          <span className="text-flag" aria-hidden>
            ⚠
          </span>
          <span>
            <span className="font-semibold">Needs a closer look.</span> {a.flagReason}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-2xl font-semibold tracking-tight">AI highlights</h3>
        <span className="text-xs text-ink-muted">
          {CONFIDENCE_TEXT[a.confidence]} · suggestions only
        </span>
      </div>

      <ul className="card divide-y divide-line">
        {criteria.map((c) => {
          const r = a.results.find((x) => x.criterionId === c.id);
          const b = baseline?.results.find((x) => x.criterionId === c.id);
          return (
            <li key={c.id} className="space-y-2 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <span className="text-[15px] leading-6 font-medium">
                  {c.description} <span className="text-xs font-normal text-ink-muted tabular-nums">{c.points} pt{c.points === 1 ? "" : "s"}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {b && (
                    <span className="flex items-center gap-1 text-xs text-ink-muted">
                      keywords <StatusBadge status={b.status} />
                    </span>
                  )}
                  {r && <StatusBadge status={r.status} />}
                </span>
              </div>
              {r?.evidence && <blockquote className="evidence">&ldquo;{r.evidence}&rdquo;</blockquote>}
              {r?.note && <p className="text-sm leading-6 text-ink-muted">{r.note}</p>}
              {b && (
                <p className="text-xs text-ink-muted">
                  Keyword match: {b.note}
                  {b.evidence ? ` (${b.evidence})` : ""}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-[15px] leading-6 text-ink-muted">{a.reason}</p>
    </div>
  );
}
