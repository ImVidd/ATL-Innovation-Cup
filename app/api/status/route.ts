import { isMockMode } from "@/lib/ai";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Tells the UI whether real AI and saving are available (never exposes keys).
export async function GET() {
  return Response.json({ ai: isMockMode() ? "mock" : "gemini", db: getDb() !== null });
}
