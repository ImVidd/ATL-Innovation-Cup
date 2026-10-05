import { z } from "zod";
import { AiError, extractRubric } from "@/lib/ai";
import { ALLOWED_RUBRIC_MIME, MAX_RUBRIC_FILE_BYTES } from "@/lib/limits";

export const maxDuration = 60;

// Either extracted text (from .txt / .docx, read in the browser) or a PDF / image as base64.
const bodySchema = z.union([
  z.object({ text: z.string().min(1).max(20_000) }),
  z.object({
    mimeType: z.enum(ALLOWED_RUBRIC_MIME),
    dataBase64: z.string().min(1).max(Math.ceil((MAX_RUBRIC_FILE_BYTES * 4) / 3) + 4),
  }),
]);

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: `Unsupported file. Use PDF, PNG, JPG, Word, TXT or CSV under ${MAX_RUBRIC_FILE_BYTES / 1_000_000} MB.` },
      { status: 400 },
    );
  }
  const started = Date.now();
  try {
    const rubric = await extractRubric(parsed.data);
    console.info(`extract-rubric ok criteria=${rubric.criteria.length} ms=${Date.now() - started}`);
    return Response.json(rubric);
  } catch (e) {
    const kind = e instanceof AiError ? e.kind : "provider";
    const message = e instanceof AiError ? e.message : "Unexpected error while reading the rubric.";
    console.error(`extract-rubric failed kind=${kind} ms=${Date.now() - started}`);
    return Response.json({ error: message, kind }, { status: kind === "rate_limit" ? 429 : 502 });
  }
}
