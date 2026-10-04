import { z } from "zod";
import { getDb } from "@/lib/db";

const bodySchema = z.object({
  sessionId: z.uuid(),
  finalScore: z.number().min(0).max(1000).nullable(),
  graderNote: z.string().max(2000),
  secondsSpent: z.number().min(0).max(24 * 3600),
});

// Saves the grader's score, note, and time for one answer.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success) {
    return Response.json({ error: "Invalid score." }, { status: 400 });
  }
  const db = getDb();
  if (!db) return Response.json({ saved: false });

  const { sessionId, finalScore, graderNote, secondsSpent } = parsed.data;
  const { error } = await db
    .from("answers")
    .update({
      final_score: finalScore,
      grader_note: graderNote,
      seconds_spent: Math.round(secondsSpent),
      scored_at: finalScore === null ? null : new Date().toISOString(),
    })
    .eq("id", id)
    .eq("session_id", sessionId);
  if (error) {
    console.error(`score save failed: ${error.code}`);
    return Response.json({ saved: false, error: "Could not save score." }, { status: 500 });
  }
  return Response.json({ saved: true });
}
