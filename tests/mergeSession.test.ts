import { describe, expect, it } from "vitest";
import { mergeSession, type SessionEdit } from "@/lib/mergeSession";
import type { Analysis, Session } from "@/lib/types";

const analysis: Analysis = { results: [], reason: "ok", confidence: "high", flag: false, flagReason: null };
const criteria = [
  { id: "C1", points: 2, description: "Defines the term" },
  { id: "C2", points: 3, description: "Gives an example" },
];

const session: Session = {
  id: "session-1",
  question: "Explain X.",
  rubricText: "2 | Defines the term\n3 | Gives an example",
  criteria,
  answers: [
    { id: "a1", label: "S1", text: "first", analysis, finalScore: 5, graderNote: "good", secondsSpent: 30 },
    { id: "a2", label: "S2", text: "second", analysis, finalScore: null, secondsSpent: 4 },
    { id: "a3", label: "S3", text: "third", analysis, finalScore: 2, secondsSpent: 12 },
  ],
};

const edit = (patch: Partial<SessionEdit>): SessionEdit => ({
  question: session.question,
  rubricText: session.rubricText,
  criteria,
  answerTexts: session.answers.map((a) => a.text),
  ...patch,
});

let n = 0;
const newId = () => `new-${++n}`;

describe("mergeSession", () => {
  it("keeps scores and AI results for unchanged answers and only analyzes the added one", () => {
    const m = mergeSession(session, edit({ answerTexts: ["first", "second", "third", "fourth"] }), newId);
    expect(m.rubricChanged).toBe(false);
    expect([m.kept, m.added, m.removed]).toEqual([3, 1, 0]);
    expect(m.session.answers[0]).toMatchObject({ id: "a1", label: "S1", finalScore: 5, graderNote: "good", secondsSpent: 30, analysis });
    expect(m.session.answers[3]).toMatchObject({ label: "S4", text: "fourth", secondsSpent: 0 });
    expect(m.analyzeIds).toEqual([m.session.answers[3].id]);
  });

  it("relabels by position when an answer is removed, and counts a lost score", () => {
    const m = mergeSession(session, edit({ answerTexts: ["second", "third"] }), newId);
    expect(m.session.answers.map((a) => [a.id, a.label])).toEqual([
      ["a2", "S1"],
      ["a3", "S2"],
    ]);
    expect([m.removed, m.removedScored]).toEqual([1, 1]);
    expect(m.analyzeIds).toEqual([]);
  });

  it("treats a reworded answer as new", () => {
    const m = mergeSession(session, edit({ answerTexts: ["first, reworded", "second", "third"] }), newId);
    expect(m.session.answers[0].finalScore).toBeUndefined();
    expect(m.session.answers[0].id).not.toBe("a1");
    expect([m.kept, m.added, m.removed, m.removedScored]).toEqual([2, 1, 1, 1]);
  });

  it("re-analyzes everything but keeps scores when the rubric changes", () => {
    const changed = [criteria[0], { ...criteria[1], description: "Gives a correct example" }];
    const m = mergeSession(session, edit({ criteria: changed }), newId);
    expect(m.rubricChanged).toBe(true);
    expect(m.analyzeIds).toEqual(["a1", "a2", "a3"]);
    expect(m.session.answers.map((a) => a.finalScore)).toEqual([5, null, 2]);
    expect(m.session.answers.every((a) => a.analysis === undefined)).toBe(true);
  });

  it("clears a score that is above the new total", () => {
    const smaller = [criteria[0], { ...criteria[1], points: 1 }]; // total 3, S1 was scored 5
    const m = mergeSession(session, edit({ criteria: smaller }), newId);
    expect(m.scoresCleared).toBe(1);
    expect(m.session.answers.map((a) => a.finalScore)).toEqual([null, null, 2]);
  });

  it("keeps two identical answers as two answers", () => {
    const twins: Session = { ...session, answers: [session.answers[0], { ...session.answers[1], text: "first" }] };
    const m = mergeSession(twins, edit({ answerTexts: ["first", "first"] }), newId);
    expect(m.session.answers.map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(m.added).toBe(0);
  });

  it("does not treat reformatting the rubric text as a rubric change", () => {
    const m = mergeSession(session, edit({ rubricText: "Defines the term (2 marks)\nGives an example (3 marks)" }), newId);
    expect(m.rubricChanged).toBe(false);
    expect(m.analyzeIds).toEqual([]);
  });
});
