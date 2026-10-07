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

  it("ignores blank lines, skips lines without a mark, and reports a zero mark by line number", () => {
    const r = parseRubric("\n2 | Good line\n\nno points here\n0 | zero points");
    expect(r.criteria).toHaveLength(1);
    expect(r.skipped).toEqual([{ line: 4, text: "no points here" }]);
    expect(r.errors.map((e) => e.line)).toEqual([5]);
  });

  it("accepts marks in brackets, before or after the description", () => {
    const r = parseRubric("Defines the term (2 marks)\nGives an example [1]\n(3 marks) Explains the cause\nNames a source 1 mark");
    expect(r.errors).toEqual([]);
    expect(r.skipped).toEqual([]);
    expect(r.criteria.map((c) => [c.points, c.description])).toEqual([
      [2, "Defines the term"],
      [1, "Gives an example"],
      [3, "Explains the cause"],
      [1, "Names a source"],
    ]);
  });

  it("skips headings and subheadings instead of flagging them", () => {
    const r = parseRubric("Part A: Definitions\n2 | Defines the term\n1. Application\nGives an example (2 marks)\nSection 2");
    expect(r.errors).toEqual([]);
    expect(r.criteria.map((c) => c.description)).toEqual(["Defines the term", "Gives an example"]);
    expect(r.skipped.map((s) => s.line)).toEqual([1, 3, 5]);
    expect(r.totalPoints).toBe(4);
  });

  it("reads a table pasted from Word or Excel (tab-separated), skipping the header row", () => {
    const r = parseRubric("Criterion\tMarks\nDefines the term\t2\nGives an example\t1.5 marks\n3\tExplains the cause\tWith evidence");
    expect(r.errors).toEqual([]);
    expect(r.skipped).toEqual([{ line: 1, text: "Criterion\tMarks" }]);
    expect(r.criteria.map((c) => [c.points, c.description])).toEqual([
      [2, "Defines the term"],
      [1.5, "Gives an example"],
      [3, "Explains the cause - With evidence"],
    ]);
  });

  it("reads a Markdown table", () => {
    const r = parseRubric("| Criterion | Marks |\n|---|---|\n| Defines the term | 2 |\n| Gives an example | 1 |");
    expect(r.criteria.map((c) => [c.points, c.description])).toEqual([
      [2, "Defines the term"],
      [1, "Gives an example"],
    ]);
    expect(r.skipped.map((s) => s.line)).toEqual([1]);
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
