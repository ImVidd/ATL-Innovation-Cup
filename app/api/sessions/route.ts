import { z } from "zod";
import { getDb } from "@/lib/db";
import { MAX_ANSWERS, MAX_CRITERIA, MAX_QUESTION_CHARS, answerInputSchema, criterionSchema } from "@/lib/limits";

const bodySchema = z.object({
  id: z.uuid(),
  question: z.string().max(MAX_QUESTION_CHARS),
  rubricText: z.string().max(10_000),
  criteria: z.array(criterionSchema).min(1).max(MAX_CRITERIA),
  answers: z.array(answerInputSchema).min(1).max(MAX_ANSWERS),
});

// Creates a grading session. If Supabase isn't configured, returns saved=false
// and the app keeps working in memory.
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: `Invalid session. Max ${MAX_ANSWERS} answers.` }, { status: 400 });
  }
  const db = getDb();
  if (!db) return Response.json({ saved: false });

  const s = parsed.data;
  const { error: sessionError } = await db.from("grading_sessions").insert({
    id: s.id,
    question: s.question,
    rubric_text: s.rubricText,
    criteria: s.criteria,
  });
  if (sessionError) {
    console.error(`session insert failed: ${sessionError.code}`);
    return Response.json({ saved: false, error: "Could not save session." });
  }

  const { error: answersError } = await db.from("answers").insert(
    s.answers.map((a, i) => ({ id: a.id, session_id: s.id, label: a.label, position: i, text: a.text })),
  );
  if (answersError) {
    console.error(`answers insert failed: ${answersError.code}`);
    return Response.json({ saved: false, error: "Could not save answers." });
  }
  return Response.json({ saved: true });
}
