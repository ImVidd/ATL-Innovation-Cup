import { z } from "zod";
import { AiError, analyzeAnswer } from "@/lib/ai";
import { getDb } from "@/lib/db";
import { MAX_ANSWER_CHARS, MAX_CRITERIA, MAX_QUESTION_CHARS, criterionSchema } from "@/lib/limits";

export const maxDuration = 60;

// One answer per request, so a failure only affects that answer.
const bodySchema = z.object({
  sessionId: z.uuid().optional(),
  question: z.string().max(MAX_QUESTION_CHARS),
  criteria: z.array(criterionSchema).min(1).max(MAX_CRITERIA),
  answer: z.object({ id: z.uuid(), text: z.string().min(1).max(MAX_ANSWER_CHARS) }),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request. Answers must be 1-${MAX_ANSWER_CHARS} characters and the rubric 1-${MAX_CRITERIA} criteria.` },
      { status: 400 },
    );
  }
  const { sessionId, question, criteria, answer } = parsed.data;

  const started = Date.now();
  try {
    const { analysis, mock } = await analyzeAnswer(question, criteria, answer.text);
    // Log only timing and outcome, never answer text.
    console.info(`analyze ok mock=${mock} criteria=${criteria.length} ms=${Date.now() - started}`);

    const db = getDb();
    if (db && sessionId) {
      const { error } = await db
        .from("answers")
        .update({ analysis })
        .eq("id", answer.id)
        .eq("session_id", sessionId);
      if (error) console.error(`analyze save failed: ${error.code}`);
    }
    return Response.json({ analysis, mock });
  } catch (e) {
    const kind = e instanceof AiError ? e.kind : "provider";
    const message = e instanceof AiError ? e.message : "Unexpected error while analyzing.";
    console.error(`analyze failed kind=${kind} ms=${Date.now() - started}`);
    return Response.json({ error: message, kind }, { status: kind === "rate_limit" ? 429 : 502 });
  }
}
