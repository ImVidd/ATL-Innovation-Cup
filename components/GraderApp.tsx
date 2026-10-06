"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Answer, Session } from "@/lib/types";
import GradeView from "./GradeView";
import ResultsView from "./ResultsView";
import SetupPanel, { type SetupInput } from "./SetupPanel";
import ThemeToggle from "./ThemeToggle";

type ServerStatus = { ai: "gemini" | "mock"; db: boolean };
type View = "setup" | "grade" | "results";

const ANALYZE_CONCURRENCY = 2; // keep low for Gemini free-tier rate limits

export default function GraderApp() {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>("setup");
  const [current, setCurrent] = useState(0);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Short confirmation after each score ("S1 saved ✓"), so the grader knows it worked.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Seconds the on-screen answer has been open in this visit (updated every second).
  const [live, setLive] = useState<{ answerId: string; secs: number } | null>(null);

  // Refs so async work always sees the latest values.
  const sessionRef = useRef<Session | null>(null);
  const savedRef = useRef(false);
  const timerStartRef = useRef<number | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const updateAnswer = useCallback((id: string, patch: Partial<Answer>) => {
    setSession((s) => (s ? { ...s, answers: s.answers.map((a) => (a.id === id ? { ...a, ...patch } : a)) } : s));
  }, []);

  // Load server status, and a saved session if the URL has ?s=<id>.
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ ai: "mock", db: false }));

    const id = new URLSearchParams(window.location.search).get("s");
    if (!id) return;
    fetch(`/api/sessions/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Could not load session.");
        savedRef.current = true;
        setSaved(true);
        setSession(data.session);
        setView("grade");
      })
      .catch((e: Error) => setNotice(`${e.message} Start a new session below.`));
  }, []);

  // Per-answer timer: runs while an answer is on screen in the grading view.
  const answerOnScreen = view === "grade" ? session?.answers[current]?.id : undefined;
  useEffect(() => {
    if (!answerOnScreen) return;
    const start = Date.now();
    timerStartRef.current = start;
    const tick = setInterval(() => setLive({ answerId: answerOnScreen, secs: (Date.now() - start) / 1000 }), 1000);
    return () => {
      clearInterval(tick);
      timerStartRef.current = null;
      const secs = (Date.now() - start) / 1000;
      setSession((s) =>
        s ? { ...s, answers: s.answers.map((a) => (a.id === answerOnScreen ? { ...a, secondsSpent: a.secondsSpent + secs } : a)) } : s,
      );
    };
  }, [answerOnScreen]);

  async function analyzeOne(s: Session, answer: Answer) {
    updateAnswer(answer.id, { analyzing: true, analysisError: undefined });
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: savedRef.current ? s.id : undefined,
          question: s.question,
          criteria: s.criteria,
          answer: { id: answer.id, text: answer.text },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
      updateAnswer(answer.id, { analyzing: false, analysis: data.analysis });
    } catch (e) {
      const message = e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Network error. Check your connection.";
      updateAnswer(answer.id, { analyzing: false, analysisError: message });
    }
  }

  async function analyzeMany(s: Session, answers: Answer[]) {
    answers.forEach((a) => updateAnswer(a.id, { analyzing: true, analysisError: undefined }));
    const queue = [...answers];
    const worker = async () => {
      while (queue.length > 0) await analyzeOne(s, queue.shift()!);
    };
    await Promise.all(Array.from({ length: Math.min(ANALYZE_CONCURRENCY, queue.length) }, worker));
  }

  async function startSession(input: SetupInput) {
    const s: Session = {
      id: crypto.randomUUID(),
      question: input.question,
      rubricText: input.rubricText,
      criteria: input.criteria,
      answers: input.answerTexts.map((text, i) => ({ id: crypto.randomUUID(), label: `S${i + 1}`, text, secondsSpent: 0 })),
    };
    setSession(s);
    setCurrent(0);
    setView("grade");
    setNotice(null);

    let ok = false;
    if (status?.db) {
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...s, answers: s.answers.map(({ id, label, text }) => ({ id, label, text })) }),
        });
        ok = Boolean((await res.json()).saved);
      } catch {
        ok = false;
      }
      if (!ok) setNotice("Could not save this session. You can keep grading, but refreshing will lose your work.");
    }
    savedRef.current = ok;
    setSaved(ok);
    if (ok) window.history.replaceState(null, "", `?s=${s.id}`);

    analyzeMany(s, s.answers);
  }

  function showToast(text: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  function saveScore(answerId: string, score: number, note: string) {
    const s = sessionRef.current;
    if (!s) return;
    const answer = s.answers.find((a) => a.id === answerId)!;
    const max = s.criteria.reduce((sum, c) => sum + c.points, 0);
    const scoredText = `${answer.label} scored ${score} / ${max}`;
    const running = timerStartRef.current ? (Date.now() - timerStartRef.current) / 1000 : 0;
    updateAnswer(answerId, { finalScore: score, graderNote: note });

    if (savedRef.current) {
      fetch(`/api/answers/${answerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: s.id, finalScore: score, graderNote: note, secondsSpent: answer.secondsSpent + running }),
      })
        .then((r) => {
          if (!r.ok) throw new Error();
          showToast(`✓ ${scoredText} · saved`);
        })
        .catch(() => setNotice(`Could not save the score for ${answer.label} to the server. It is kept on this page.`));
    } else {
      showToast(`✓ ${scoredText} · kept on this page (not saved to a server)`);
    }

    // Move to the next unscored answer, or to results when everything is scored.
    const idx = s.answers.findIndex((a) => a.id === answerId);
    const isUnscored = (a: Answer) => a.id !== answerId && (a.finalScore === null || a.finalScore === undefined);
    const after = s.answers.findIndex((a, i) => i > idx && isUnscored(a));
    const next = after !== -1 ? after : s.answers.findIndex(isUnscored);
    if (next === -1) setView("results");
    else setCurrent(next);
  }

  function newSession() {
    if (!window.confirm("Start a new question? Your current scores stay saved only if this session was saved.")) return;
    setSession(null);
    setView("setup");
    setSaved(false);
    savedRef.current = false;
    window.history.replaceState(null, "", window.location.pathname);
  }

  const totalPoints = session ? session.criteria.reduce((sum, c) => sum + c.points, 0) : 0;
  const scoredCount = session?.answers.filter((a) => a.finalScore !== null && a.finalScore !== undefined).length ?? 0;
  const flaggedCount = session?.answers.filter((a) => a.analysis?.flag).length ?? 0;
  const currentAnswer = session?.answers[current];
  const elapsed = currentAnswer ? currentAnswer.secondsSpent + (live?.answerId === currentAnswer.id ? live.secs : 0) : 0;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          {/* Both marks are rendered; globals.css shows the one for the active theme. Plain <img>: SVGs gain nothing from next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="" width={40} height={40} className="logo-light h-10 w-10" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark-dark.svg" alt="" width={40} height={40} className="logo-dark h-10 w-10" />
          <div>
            <h1 className="font-serif text-[26px] leading-[30px] font-semibold tracking-tight">TA Grader</h1>
            <p className="text-sm text-ink-muted">AI highlights rubric matches. You decide every score.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {session && (
            <>
              <button type="button" className={view === "grade" ? "btn-primary" : "btn-secondary"} onClick={() => setView("grade")}>
                Grade
              </button>
              <button type="button" className={view === "results" ? "btn-primary" : "btn-secondary"} onClick={() => setView("results")}>
                Results &amp; export
              </button>
              <button type="button" className="btn-secondary" onClick={newSession}>
                New question
              </button>
            </>
          )}
          <ThemeToggle />
        </div>
      </header>

      {status?.ai === "mock" && (
        <div className="mb-4 callout callout-info" role="status">
          <strong>Mock mode: AI results are fake.</strong> No Gemini API key is set on the server.
        </div>
      )}
      {notice && (
        <div className="mb-4 callout callout-danger" role="alert">
          {notice}
        </div>
      )}

      {session && view !== "setup" && (
        <div className="mb-6 space-y-2 rounded-lg bg-sunken px-5 py-4">
          <p className="font-serif text-xl leading-7">{session.question || "(no question text)"}</p>
          <p className="text-sm text-ink-muted">
            {totalPoints} points possible · {session.answers.length} answers · <strong className="font-semibold text-ink">{scoredCount} of {session.answers.length} scored</strong> ·{" "}
            {flaggedCount} flagged
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-line" aria-hidden>
            <div className="h-full rounded-full bg-met transition-all" style={{ width: `${(scoredCount / session.answers.length) * 100}%` }} />
          </div>
          <p className="text-xs text-ink-muted">
            {saved ? "Saved. Bookmark this page's link to come back to this session." : "Not saved to a server. Refreshing the page clears your work."}
          </p>
        </div>
      )}

      {view === "setup" || !session ? (
        <SetupPanel onStart={startSession} />
      ) : view === "grade" ? (
        <GradeView
          session={session}
          totalPoints={totalPoints}
          current={current}
          elapsedSeconds={elapsed}
          onSelect={setCurrent}
          onSave={saveScore}
          onRetry={(id) => {
            const a = session.answers.find((x) => x.id === id);
            if (a) analyzeOne(session, a);
          }}
        />
      ) : (
        <ResultsView
          session={session}
          totalPoints={totalPoints}
          onBack={(i) => {
            setCurrent(i);
            setView("grade");
          }}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-float"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}

      <footer className="mt-10 border-t border-line pt-4 text-xs text-ink-muted">
        AI suggestions only. The grader decides every score. Use fake or anonymized answers: do not enter student names or IDs.
        Answers are sent to Google Gemini for analysis{status?.db ? " and saved to the team's database" : ""}.
      </footer>
    </div>
  );
}
