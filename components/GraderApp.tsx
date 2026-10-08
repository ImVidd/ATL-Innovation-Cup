"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mergeSession } from "@/lib/mergeSession";
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
  // Changing this remounts the setup steps, sending the grader back to step 1.
  const [setupKey, setSetupKey] = useState(0);

  // Refs so async work always sees the latest values.
  const sessionRef = useRef<Session | null>(null);
  const savedRef = useRef(false);
  const timerStartRef = useRef<number | null>(null);
  // Goes up when the question or rubric is edited, so AI results for the old rubric are dropped.
  const rubricVersionRef = useRef(0);
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
    const rubricVersion = rubricVersionRef.current;
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
      if (rubricVersion !== rubricVersionRef.current) return; // rubric edited meanwhile; a fresh analysis is on its way
      updateAnswer(answer.id, { analyzing: false, analysis: data.analysis });
    } catch (e) {
      if (rubricVersion !== rubricVersionRef.current) return;
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

  // "Edit setup": apply changes to the session in progress. Unchanged answers keep their scores,
  // and only new answers (or all of them, if the question or rubric changed) go back to the AI.
  async function updateSession(input: SetupInput) {
    const old = sessionRef.current;
    if (!old) return;
    const m = mergeSession(old, input, () => crypto.randomUUID());

    const losses: string[] = [];
    if (m.removedScored > 0) losses.push(`${m.removedScored} answer${m.removedScored === 1 ? "" : "s"} you already scored will be removed (removed or reworded answers lose their score)`);
    if (m.scoresCleared > 0) losses.push(`${m.scoresCleared} score${m.scoresCleared === 1 ? "" : "s"} above the new total of marks will be cleared`);
    if (losses.length > 0 && !window.confirm(`${losses.join(", and ")}. Continue?`)) return;

    if (m.rubricChanged) rubricVersionRef.current++;
    const s = m.session;
    setSession(s);
    const firstUnscored = s.answers.findIndex((a) => a.finalScore === null || a.finalScore === undefined);
    setCurrent(firstUnscored === -1 ? 0 : firstUnscored);
    setView("grade");
    setNotice(null);

    const parts = [`${m.kept} answer${m.kept === 1 ? "" : "s"} kept`];
    if (m.added > 0) parts.push(`${m.added} added`);
    if (m.removed > 0) parts.push(`${m.removed} removed`);
    if (m.rubricChanged) parts.push("rubric changed, so the AI is re-reading every answer");
    showToast(`✓ Setup updated · ${parts.join(" · ")}`);

    if (savedRef.current) {
      let ok = false;
      try {
        const res = await fetch(`/api/sessions/${s.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: s.question,
            rubricText: s.rubricText,
            criteria: s.criteria,
            answers: s.answers.map((a) => ({
              id: a.id,
              label: a.label,
              text: a.text,
              analysis: a.analysis ?? null,
              finalScore: a.finalScore ?? null,
              graderNote: a.graderNote ?? "",
              secondsSpent: a.secondsSpent,
            })),
          }),
        });
        ok = res.ok && Boolean((await res.json()).saved);
      } catch {
        ok = false;
      }
      if (!ok) {
        // The server copy is now out of date, so stop writing scores to it.
        savedRef.current = false;
        setSaved(false);
        window.history.replaceState(null, "", window.location.pathname);
        setNotice("Could not save these changes to the server. You can keep grading, but refreshing will lose your work.");
      }
    }

    analyzeMany(s, s.answers.filter((a) => m.analyzeIds.includes(a.id)));
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

  // The logo: back to the first setup step. With a session open, that means starting a new question.
  function goHome() {
    if (sessionRef.current) {
      newSession();
      return;
    }
    setSetupKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  const navItems: [View, string][] = [
    ["grade", "Grade"],
    ["results", "Results"],
    ["setup", "Setup"],
  ];

  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <button
            type="button"
            onClick={goHome}
            className="flex items-center gap-2.5 rounded-full pr-2 transition-opacity hover:opacity-75"
            aria-label="TA Grader: back to the start"
          >
            {/* Both marks are rendered; globals.css shows the one for the active theme. Plain <img>: SVGs gain nothing from next/image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.svg" alt="" width={32} height={32} className="logo-light h-8 w-8" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark-dark.svg" alt="" width={32} height={32} className="logo-dark h-8 w-8" />
            <span className="text-lg font-semibold tracking-tight">TA Grader</span>
          </button>
          <div className="flex items-center gap-2">
            {session && (
              <>
                <nav className="seg hidden sm:inline-flex" aria-label="Views">
                  {navItems.map(([v, label]) => (
                    <button key={v} type="button" className="seg-option" aria-pressed={view === v} onClick={() => setView(v)}>
                      {label}
                    </button>
                  ))}
                </nav>
                <button type="button" className="btn-ghost" onClick={newSession}>
                  New
                </button>
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
        {session && view !== "setup" && (
          <div className="h-0.5 w-full bg-line" aria-hidden>
            <div className="h-full bg-met transition-all duration-500" style={{ width: `${(scoredCount / session.answers.length) * 100}%` }} />
          </div>
        )}
      </header>

      {session && (
        <nav className="seg mx-auto mt-4 sm:hidden" aria-label="Views">
          {navItems.map(([v, label]) => (
            <button key={v} type="button" className="seg-option" aria-pressed={view === v} onClick={() => setView(v)}>
              {label}
            </button>
          ))}
        </nav>
      )}

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-10 pb-10">
      {(status?.ai === "mock" || notice) && (
        <div className={`mx-auto mb-8 space-y-2 ${!session || view === "setup" ? "max-w-2xl" : "max-w-3xl"}`}>
          {status?.ai === "mock" && (
            <p className="callout callout-info rounded-2xl px-5 py-2 text-xs" role="status">
              <strong>Mock mode:</strong> AI results are fake. No Gemini API key is set on the server.
            </p>
          )}
          {notice && (
            <p className="callout callout-danger rounded-lg" role="alert">
              {notice}
            </p>
          )}
        </div>
      )}

      {session && view === "grade" && (
        <div className="mx-auto mb-10 max-w-3xl">
          <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Exam question</p>
          <h1 className="mt-2 text-[28px] leading-9 font-semibold tracking-[-0.02em] text-ink">{session.question || "(no question text)"}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {scoredCount} of {session.answers.length} scored · {flaggedCount} flagged · {totalPoints} pts ·{" "}
            {saved ? "saved, bookmark this link to come back" : "not saved, refreshing clears your work"}
          </p>
        </div>
      )}

      {!session ? (
        <SetupPanel key={setupKey} onStart={startSession} />
      ) : view === "setup" ? (
        <SetupPanel
          key={session.id}
          onStart={updateSession}
          initial={{ question: session.question, rubricText: session.rubricText, answersText: session.answers.map((a) => a.text).join("\n---\n") }}
          onCancel={() => setView("grade")}
        />
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

      </main>

      {toast && (
        <div
          key={toast}
          className="fade-up fixed top-20 left-1/2 z-50 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-primary px-5 py-2.5 text-center text-sm font-semibold text-on-primary shadow-float"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}

      {!(session && view === "grade") && (
        <footer className="mx-auto w-full max-w-5xl px-4 pb-8 text-center text-xs text-ink-muted">
          The AI suggests, you decide every score. Use fake or anonymized answers. Answers are sent to Google Gemini
          {status?.db ? " and saved to the team's database" : ""}.
        </footer>
      )}
    </div>
  );
}
