import { describe, expect, it } from "vitest";
import { parseRubric } from "@/lib/parseRubric";
import { SAMPLE_ANSWERS, SAMPLE_RUBRIC } from "@/lib/sampleData";
import { splitAnswers } from "@/lib/splitAnswers";

describe("parseRubric", () => {
  it("parses the sample rubric", () => {
    const r = parseRubric(SAMPLE_RUBRIC);
    expect(r.errors).toEqual([]);
    expect(r.criteria.map((c) => c.id)).toEqual(["C1", "C2", "C3"]);
    expect(r.criteria[0]).toEqual({
      id: "C1",
      points: 2,
      description: "Defines operant conditioning (behavior shaped by consequences)",
    });
    expect(r.totalPoints).toBe(5);
  });

  it("accepts points-last formats", () => {
    const r = parseRubric("Names the cause: 2 pts\nGives evidence - 1.5 points\nUses a source (3 pts)");
    expect(r.errors).toEqual([]);
    expect(r.criteria.map((c) => [c.points, c.description])).toEqual([
      [2, "Names the cause"],
      [1.5, "Gives evidence"],
      [3, "Uses a source"],
    ]);
  });

  it("ignores blank lines and reports bad lines by line number", () => {
    const r = parseRubric("\n2 | Good line\n\nno points here\n0 | zero points");
    expect(r.criteria).toHaveLength(1);
    expect(r.errors.map((e) => e.line)).toEqual([4, 5]);
  });

  it("returns nothing for empty input", () => {
    const r = parseRubric("   \n  ");
    expect(r.criteria).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.totalPoints).toBe(0);
  });
});

describe("splitAnswers", () => {
  it("splits the sample answers into 4", () => {
    const answers = splitAnswers(SAMPLE_ANSWERS);
    expect(answers).toHaveLength(4);
    expect(answers[2]).toMatch(/^Classical conditioning/);
  });

  it("drops empty answers, including a trailing ---", () => {
    expect(splitAnswers("one\n---\n\n---\ntwo\n---\n")).toEqual(["one", "two"]);
  });

  it("keeps multi-line answers together and does not split on inline dashes", () => {
    expect(splitAnswers("line a\nline b -- still a\n---\nb")).toEqual(["line a\nline b -- still a", "b"]);
  });
});
