"use client";

import { useState } from "react";
import { MAX_ANSWERS, MAX_ANSWER_CHARS } from "@/lib/limits";
import { parseRubric } from "@/lib/parseRubric";
import { SAMPLE_ANSWERS, SAMPLE_QUESTION, SAMPLE_RUBRIC } from "@/lib/sampleData";
import { splitAnswers } from "@/lib/splitAnswers";
import type { Criterion } from "@/lib/types";

export type SetupInput = {
  question: string;
  rubricText: string;
  criteria: Criterion[];
  answerTexts: string[];
};

export default function SetupPanel({ onStart }: { onStart: (input: SetupInput) => void }) {
  const [question, setQuestion] = useState("");
  const [rubricText, setRubricText] = useState("");
  const [answersText, setAnswersText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const rubric = parseRubric(rubricText);
  const answers = splitAnswers(answersText);
  const tooLong = answers
    .map((a, i) => ({ label: `S${i + 1}`, len: a.length }))
    .filter((a) => a.len > MAX_ANSWER_CHARS);

  const problems: string[] = [];
  if (rubric.criteria.length === 0 && rubric.errors.length === 0) {
    problems.push('Add at least one rubric line, for example "2 | Defines operant conditioning".');
  }
  if (rubric.errors.length > 0) problems.push("Fix the rubric lines marked above.");
  if (answers.length === 0) problems.push("Add at least one student answer.");
  if (answers.length > MAX_ANSWERS) problems.push(`Too many answers: max ${MAX_ANSWERS} per session.`);
  if (tooLong.length > 0) {
    problems.push(`${tooLong.map((a) => a.label).join(", ")} over ${MAX_ANSWER_CHARS} characters. Shorten or split them.`);
  }

  function insertSample() {
    setQuestion(SAMPLE_QUESTION);
    setRubricText(SAMPLE_RUBRIC);
    setAnswersText(SAMPLE_ANSWERS);
  }

  function start(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (problems.length > 0) return;
    onStart({ question: question.trim(), rubricText, criteria: rubric.criteria, answerTexts: answers });
  }

  return (
    <form onSubmit={start} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Set up one question</h2>
          <p className="text-sm text-slate-600">Paste the question, the rubric, and the typed answers. Answers are labeled S1, S2, ... automatically.</p>
        </div>
        <button type="button" onClick={insertSample} className="btn-secondary">
          Insert sample (fake data)
        </button>
      </div>

      <label className="block">
        <span className="label">Exam question</span>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          className="input"
          placeholder="e.g. Explain operant conditioning and give one example."
        />
      </label>

      <label className="block">
        <span className="label">Rubric (one criterion per line)</span>
        <span className="hint">
          Format: <code>points | description</code>, e.g. <code>2 | Gives a correct example</code>. &quot;Names the cause: 2 pts&quot; also works.
        </span>
        <textarea
          value={rubricText}
          onChange={(e) => setRubricText(e.target.value)}
          rows={5}
          className="input font-mono text-sm"
          placeholder={"2 | Defines operant conditioning\n2 | Gives a correct example\n1 | Mentions reinforcement or punishment"}
        />
        {rubric.criteria.length > 0 && (
          <span className="mt-1 block text-sm text-slate-600">
            {rubric.criteria.length} criteria · {rubric.totalPoints} points total
          </span>
        )}
        {rubric.errors.map((err) => (
          <span key={err.line} className="mt-1 block text-sm text-red-700" role="alert">
            Line {err.line} (&quot;{err.text}&quot;): {err.message}
          </span>
        ))}
      </label>

      <label className="block">
        <span className="label">Student answers</span>
        <span className="hint">
          Separate answers with a line containing only <code>---</code>. Use fake or anonymized answers only. No names or student IDs.
        </span>
        <textarea
          value={answersText}
          onChange={(e) => setAnswersText(e.target.value)}
          rows={10}
          className="input text-sm"
          placeholder={"First answer...\n---\nSecond answer...\n---\nThird answer..."}
        />
        <span className="mt-1 block text-sm text-slate-600">{answers.length} answer{answers.length === 1 ? "" : "s"} detected</span>
      </label>

      {submitted && problems.length > 0 && (
        <ul className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {problems.map((p) => (
            <li key={p}>• {p}</li>
          ))}
        </ul>
      )}

      <button type="submit" className="btn-primary w-full sm:w-auto">
        Start grading{answers.length > 0 ? ` ${answers.length} answer${answers.length === 1 ? "" : "s"}` : ""}
      </button>
    </form>
  );
}
