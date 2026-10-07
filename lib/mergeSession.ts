import type { Answer, Criterion, Session } from "./types";

export type SessionEdit = {
  question: string;
  rubricText: string;
  criteria: Criterion[];
  answerTexts: string[];
};

export type MergeResult = {
  session: Session;
  analyzeIds: string[]; // answers the AI needs to read (new, or all of them if the rubric changed)
  rubricChanged: boolean;
  kept: number; // answers whose text did not change
  added: number;
  removed: number;
  removedScored: number; // removed answers that already had a score
  scoresCleared: number; // kept answers whose score no longer fits the new total
};

const isScored = (a: Answer) => a.finalScore !== null && a.finalScore !== undefined;

const sameRubric = (a: Criterion[], b: Criterion[]) =>
  a.length === b.length && a.every((c, i) => c.points === b[i].points && c.description === b[i].description);

// Applies an edited setup to a session in progress without throwing away work.
// An answer whose text is unchanged keeps its id, score, note, time and (if the rubric and
// question are unchanged) its AI highlights. Answers are relabeled S1, S2, ... by position.
export function mergeSession(old: Session, edit: SessionEdit, newId: () => string): MergeResult {
  const rubricChanged = old.question !== edit.question || !sameRubric(old.criteria, edit.criteria);
  const totalPoints = edit.criteria.reduce((sum, c) => sum + c.points, 0);

  // Each old answer can be matched once, so two identical answers stay two answers.
  const unused = [...old.answers];
  let kept = 0;
  let scoresCleared = 0;

  const answers: Answer[] = edit.answerTexts.map((text, i) => {
    const label = `S${i + 1}`;
    const matchIndex = unused.findIndex((a) => a.text === text);
    if (matchIndex === -1) return { id: newId(), label, text, secondsSpent: 0 };

    const [match] = unused.splice(matchIndex, 1);
    kept++;
    const scoreFits = !isScored(match) || match.finalScore! <= totalPoints;
    if (!scoreFits) scoresCleared++;
    return {
      id: match.id,
      label,
      text,
      secondsSpent: match.secondsSpent,
      graderNote: match.graderNote,
      finalScore: scoreFits ? match.finalScore : null,
      analysis: rubricChanged ? undefined : match.analysis,
    };
  });

  return {
    session: { id: old.id, question: edit.question, rubricText: edit.rubricText, criteria: edit.criteria, answers },
    analyzeIds: answers.filter((a) => !a.analysis).map((a) => a.id),
    rubricChanged,
    kept,
    added: answers.length - kept,
    removed: unused.length,
    removedScored: unused.filter(isScored).length,
    scoresCleared,
  };
}
