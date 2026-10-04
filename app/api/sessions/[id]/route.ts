import { z } from "zod";
import { getDb } from "@/lib/db";
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
