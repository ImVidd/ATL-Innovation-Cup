import { describe, expect, it } from "vitest";
import { extractJson, validateAnalysis } from "@/lib/analysis";
import { baselineAnalysis, keywordsFor } from "@/lib/baseline";
import { toCsv } from "@/lib/csv";
import { mockAnalysis } from "@/lib/mock";
import { parseRubric } from "@/lib/parseRubric";
import { SAMPLE_ANSWERS, SAMPLE_RUBRIC } from "@/lib/sampleData";
import { splitAnswers } from "@/lib/splitAnswers";

const criteria = parseRubric(SAMPLE_RUBRIC).criteria;
const [s1, s2, s3, s4] = splitAnswers(SAMPLE_ANSWERS);
const statuses = (text: string) => baselineAnalysis(text, criteria).results.map((r) => r.status);

describe("baseline keyword matcher", () => {
  it("drops stopwords and short words", () => {
    expect(keywordsFor("Mentions reinforcement or punishment")).toEqual(["reinforcement", "punishment"]);
  });

  it("S1 (full answer) meets the definition", () => {
    expect(statuses(s1)[0]).toBe("met");
  });

  it('known limit: can\'t read "or", so "reinforcement or punishment" is only partial for S1', () => {
    expect(statuses(s1)[2]).toBe("partial");
  });

  it("S3 (classical conditioning) does not meet the definition", () => {
    expect(statuses(s3)[0]).toBe("not_met");
  });

  it("never assigns a score", () => {
    expect(JSON.stringify(baselineAnalysis(s1, criteria))).not.toMatch(/score/i);
  });
});

describe("mock mode", () => {
  it("flags the injected instruction in S4", () => {
    const a = mockAnalysis(s4, criteria);
    expect(a.flag).toBe(true);
    expect(a.flagReason).toMatch(/instructions/);
  });

  it("flags the thin S2 and the off-topic S3, not S1", () => {
    expect(mockAnalysis(s2, criteria).flag).toBe(true);
    expect(mockAnalysis(s3, criteria).flag).toBe(true);
    expect(mockAnalysis(s1, criteria).flag).toBe(false);
  });

  it("labels results as fake", () => {
    expect(mockAnalysis(s1, criteria).reason).toMatch(/Mock/);
  });
});

describe("validateAnalysis", () => {
  const good = {
    results: [
      { criterionId: "C1", status: "met", evidence: "learning where behavior changes because of its consequences", note: "Clear definition." },
      { criterionId: "C2", status: "met", evidence: "a dog learns to sit", note: "Valid example." },
      { criterionId: "C3", status: "met", evidence: "positive reinforcement", note: "Mentions reinforcement." },
    ],
    reason: "Complete answer.",
    confidence: "high",
    flag: false,
    flagReason: null,
  };

  it("accepts valid output", () => {
    const a = validateAnalysis(good, criteria, s1);
    expect(a.flag).toBe(false);
    expect(a.results).toHaveLength(3);
  });

  it("parses JSON wrapped in a code fence", () => {
    expect(extractJson("```json\n" + JSON.stringify(good) + "\n```")).toEqual(good);
  });

  it("rejects output missing a criterion (so the caller retries)", () => {
    expect(() => validateAnalysis({ ...good, results: good.results.slice(0, 2) }, criteria, s1)).toThrow(/C3/);
  });

  it("rejects invalid status values", () => {
    const bad = { ...good, results: [{ ...good.results[0], status: "great" }, ...good.results.slice(1)] };
    expect(() => validateAnalysis(bad, criteria, s1)).toThrow();
  });

  it("removes a quote that is not in the answer and flags it", () => {
    const fake = { ...good, results: [{ ...good.results[0], evidence: "words the student never wrote" }, ...good.results.slice(1)] };
    const a = validateAnalysis(fake, criteria, s1);
    expect(a.results[0].evidence).toBe("");
    expect(a.flag).toBe(true);
  });

  it("forces a flag when confidence is low", () => {
    const a = validateAnalysis({ ...good, confidence: "low" }, criteria, s1);
    expect(a.flag).toBe(true);
    expect(a.flagReason).toBeTruthy();
  });

  it("always flags an answer that meets no criteria (e.g. S3, wrong concept)", () => {
    const none = {
      ...good,
      results: good.results.map((r) => ({ ...r, status: "not_met", evidence: "" })),
      flag: false,
      flagReason: null,
    };
    const a = validateAnalysis(none, criteria, s3);
    expect(a.flag).toBe(true);
    expect(a.flagReason).toMatch(/No rubric criteria met/);
  });

  it("drops criteria the rubric does not have", () => {
    const extra = { ...good, results: [...good.results, { criterionId: "C9", status: "met", evidence: "", note: "" }] };
    expect(validateAnalysis(extra, criteria, s1).results.map((r) => r.criterionId)).toEqual(["C1", "C2", "C3"]);
  });
});

describe("CSV export", () => {
  it("has anonymous IDs and no answer text, and escapes commas", () => {
    const csv = toCsv(
      [{ id: "x", label: "S1", text: "secret answer text", finalScore: 4, graderNote: "good, clear", secondsSpent: 42.4 }],
      5,
    );
    expect(csv).toBe(
      'answer_id,final_score,max_points,seconds_spent,ai_flagged,ai_confidence,grader_note\nS1,4,5,42,,,"good, clear"\n',
    );
    expect(csv).not.toMatch(/secret/);
  });
});
