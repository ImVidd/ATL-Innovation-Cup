import { z } from "zod";

// Input limits, shared by the UI (to show errors early) and the API (to enforce them).
export const MAX_ANSWERS = 60;
export const MAX_ANSWER_CHARS = 3000;
export const MAX_CRITERIA = 20;
export const MAX_QUESTION_CHARS = 2000;

export const criterionSchema = z.object({
  id: z.string().max(10),
  points: z.number().positive().max(1000),
  description: z.string().min(1).max(500),
});

export const answerInputSchema = z.object({
  id: z.uuid(),
  label: z.string().max(10),
  text: z.string().min(1).max(MAX_ANSWER_CHARS),
});

// Rubric uploads sent to the AI. Vercel caps request bodies at ~4.5 MB, and base64 adds a third.
export const MAX_RUBRIC_FILE_BYTES = 3_000_000;
export const ALLOWED_RUBRIC_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;
