// Shared data shapes. Answers are only ever labeled S1, S2, ... (no student names).

export type Criterion = { id: string; points: number; description: string };

export type CriterionStatus = "met" | "partial" | "not_met";

export type CriterionResult = {
  criterionId: string;
  status: CriterionStatus;
  evidence: string; // short quote copied from the answer, or "" if none
  note: string; // one sentence explaining the call
};

export type Confidence = "high" | "medium" | "low";

export type Analysis = {
  results: CriterionResult[];
  reason: string;
  confidence: Confidence;
  flag: boolean; // true = needs a closer look from the grader
  flagReason: string | null;
};

export type Answer = {
  id: string; // uuid, used as the database key
  label: string; // "S1", "S2", ... shown to the grader
  text: string;
  analysis?: Analysis;
  analysisError?: string;
  analyzing?: boolean;
  finalScore?: number | null; // set ONLY by the grader
  graderNote?: string;
  secondsSpent: number; // grading time, from the per-answer timer
};

export type Session = {
  id: string;
  question: string;
  rubricText: string;
  criteria: Criterion[];
  answers: Answer[];
};
