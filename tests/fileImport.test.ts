import { describe, expect, it } from "vitest";
import { answersFromCsv, criteriaToRubricText, parseCsv, rubricTextFromCsv } from "@/lib/fileImport";
import { parseRubric } from "@/lib/parseRubric";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas and newlines inside cells", () => {
    expect(parseCsv('a,"b, c","say ""hi"""\n"multi\nline",x,y\r\n')).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["multi\nline", "x", "y"],
    ]);
  });

  it("drops blank rows", () => {
    expect(parseCsv("a,b\n\n,\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });
});

describe("rubricTextFromCsv", () => {
  it("accepts points in either column, skips the header, and parses cleanly", () => {
    const text = rubricTextFromCsv("criterion,points\nHas a main function,2\n3 pts,Correct result");
    expect(text).toBe("2 | Has a main function\n3 | Correct result");
    expect(parseRubric(text).errors).toEqual([]);
  });
});

describe("answersFromCsv", () => {
  it("uses the answer column and ignores name/ID columns", () => {
    const csv = 'student_name,student_id,answer\nJane,123,"def main():\n    pass"\nBob,456,Second answer';
    const answers = answersFromCsv(csv);
    expect(answers).toEqual(["def main():\n    pass", "Second answer"]);
    expect(answers.join(" ")).not.toMatch(/Jane|123|Bob/);
  });

  it("falls back to the first column when there is no header", () => {
    expect(answersFromCsv("first answer\nsecond answer")).toEqual(["first answer", "second answer"]);
  });
});

describe("criteriaToRubricText", () => {
  it("produces lines the rubric parser accepts", () => {
    const text = criteriaToRubricText([{ points: 2, description: "Defines\n  the term" }, { points: 1.5, description: "Gives | example" }]);
    expect(text).toBe("2 | Defines the term\n1.5 | Gives | example");
    expect(parseRubric(text).criteria.map((c) => c.points)).toEqual([2, 1.5]);
  });
});
