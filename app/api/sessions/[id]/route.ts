import { z } from "zod";
import { getDb } from "@/lib/db";
import { MAX_ANSWERS, MAX_CRITERIA, MAX_QUESTION_CHARS, answerInputSchema, criterionSchema } from "@/lib/limits";
import type { Session } from "@/lib/types";

// Loads a saved session so a grader can come back to it via its link.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "Invalid session link." }, { status: 400 });
  }
  const db = getDb();
  if (!db) return Response.json({ error: "Saving is not enabled on this server." }, { status: 404 });

  const { data: s, error } = await db
    .from("grading_sessions")
    .select("id, question, rubric_text, criteria")
    .eq("id", id)
    .maybeSingle();
  if (error || !s) return Response.json({ error: "Session not found." }, { status: 404 });

  const { data: rows, error: answersError } = await db
    .from("answers")
    .select("id, label, text, analysis, final_score, grader_note, seconds_spent")
    .eq("session_id", id)
    .order("position");
  if (answersError) return Response.json({ error: "Could not load answers." }, { status: 500 });

  const session: Session = {
    id: s.id,
    question: s.question,
    rubricText: s.rubric_text,
    criteria: s.criteria,
    answers: (rows ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      text: r.text,
      analysis: r.analysis ?? undefined,
      finalScore: r.final_score === null ? null : Number(r.final_score),
      graderNote: r.grader_note ?? "",
      secondsSpent: r.seconds_spent ?? 0,
    })),
  };
  return Response.json({ session });
}

const updateSchema = z.object({
  question: z.string().max(MAX_QUESTION_CHARS),
  rubricText: z.string().max(10_000),
  criteria: z.array(criterionSchema).min(1).max(MAX_CRITERIA),
  answers: z
    .array(
      answerInputSchema.extend({
        analysis: z.record(z.string(), z.unknown()).nullable(),
        finalScore: z.number().min(0).max(1000).nullable(),
        graderNote: z.string().max(2000),
        secondsSpent: z.number().min(0).max(24 * 3600),
      }),
    )
    .min(1)
    .max(MAX_ANSWERS),
});

// Replaces a saved session after the grader edits its setup: updates the question and rubric,
// removes answers that were deleted, and adds or updates the rest (keeping their scores).
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success) {
    return Response.json({ error: `Invalid session. Max ${MAX_ANSWERS} answers.` }, { status: 400 });
  }
  const db = getDb();
  if (!db) return Response.json({ saved: false });

  const s = parsed.data;
  const fail = (step: string, code?: string) => {
    console.error(`session update failed step=${step} code=${code}`);
    return Response.json({ saved: false, error: "Could not save the changes." }, { status: 500 });
  };

  const { data: updated, error: sessionError } = await db
    .from("grading_sessions")
    .update({ question: s.question, rubric_text: s.rubricText, criteria: s.criteria })
    .eq("id", id)
    .select("id");
  if (sessionError) return fail("session", sessionError.code);
  if (!updated?.length) return Response.json({ saved: false, error: "Session not found." }, { status: 404 });

  // Ids are validated as UUIDs above, so they are safe to place in the filter.
  const keepIds = s.answers.map((a) => a.id);
  const { error: deleteError } = await db.from("answers").delete().eq("session_id", id).not("id", "in", `(${keepIds.join(",")})`);
  if (deleteError) return fail("delete", deleteError.code);

  const { error: upsertError } = await db.from("answers").upsert(
    s.answers.map((a, i) => ({
      id: a.id,
      session_id: id,
      label: a.label,
      position: i,
      text: a.text,
      analysis: a.analysis,
      final_score: a.finalScore,
      grader_note: a.graderNote,
      seconds_spent: Math.round(a.secondsSpent),
    })),
  );
  if (upsertError) return fail("upsert", upsertError.code);

  // A score cleared by the edit should no longer count as scored.
  const { error: clearError } = await db.from("answers").update({ scored_at: null }).eq("session_id", id).is("final_score", null);
  if (clearError) return fail("scored_at", clearError.code);

  return Response.json({ saved: true });
}