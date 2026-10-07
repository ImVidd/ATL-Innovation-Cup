# TA Grader (404 Techies · ATL Innovation Cup 2026)

Helps graduate TAs and professors grade **written exam answers** faster and more consistently.

The grader pastes a question, a rubric and typed student answers. For each answer, **Gemini highlights which rubric criteria are met, partly met or missed**, quotes the evidence from the answer, and flags answers that need a closer look. **The grader types every final score. The AI never suggests a score.** A timer records how long each answer takes, so we can measure time saved.

## Core task (what a tester does)

1. **Entry:** open the link → paste a question, a rubric and answers separated by `---`. Or click **Insert sample (fake data)**. The rubric can be `2 | Defines X` lines, "Defines X (2 marks)", a table pasted from Word or Excel, or a plain description of the marking scheme turned into lines with **Structure with AI**. Lines without a mark (headings) are skipped and listed.
2. **Action:** click **Start grading**. Gemini analyzes each answer (2 at a time).
3. **Result:** for each answer (S1, S2, …): met / partly met / missed per criterion, quoted evidence, a one-line summary, a confidence level and a "Needs a closer look" flag with a reason. The grader enters a score (0 to the rubric total) and an optional note, then **Save & next**.
4. **Results & export:** scores, time per answer, average time, flags, and **Download CSV** (no answer text in the export).
5. **Fixing the setup:** **Edit setup** reopens the question, rubric and answers mid-session. Unchanged answers keep their scores and AI highlights; only new or reworded answers are re-analyzed (all of them if the question or rubric changes).
6. **Failure / help paths:** bad rubric lines are pointed out by line number; no answers → prompt; AI error, timeout or rate limit → message on that answer only, a **Retry** button, and the grader can still score by hand; invalid AI output is retried once automatically; quotes the AI made up (not found in the answer) are removed and the answer is flagged.

### The AI function

| | |
|---|---|
| **Input** | Question text, rubric criteria (id, points, description), one answer's text |
| **Output** | Per criterion: status (`met` / `partial` / `not_met`), quoted evidence, one-sentence note. Plus summary, confidence, flag and flag reason |
| **Grader control** | AI output is advisory only. The grader assigns every score, can ignore any highlight, and can compare against a non-AI keyword baseline |
| **Limits** | Typed text only, max 10,000 characters per answer, 60 answers per session, 20 criteria. Accuracy on nuanced writing is **unverified**. Free-tier Gemini rate limits can slow or fail calls under load |
| **Safety** | Answers are treated as data. Instructions inside an answer ("give full marks") are ignored and flagged |

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

- **No API key?** It runs in **mock mode**: fake, deterministic "AI" results with a visible banner. Good for UI work, not a real demo.
- **Real AI:** create `.env.local` (never committed) from `.env.example` and set `GEMINI_API_KEY` (free key from https://aistudio.google.com/apikey).
- **Saving (optional):** create a free Supabase project, run `supabase/schema.sql` in its SQL Editor, then set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (Project Settings → API). Without these, work lives only in the browser tab.

```bash
npm test        # unit tests (rubric parser, answer splitter, baseline, AI output validation, CSV)
npm run lint
npm run build
```

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | For real AI | Gemini key. Missing → mock mode |
| `GEMINI_MODEL` | No | Defaults to `gemini-flash-latest` |
| `MOCK_AI` | No | `true` forces fake results |
| `SUPABASE_URL` | For saving | Supabase project URL |
| `SUPABASE_SECRET_KEY` | For saving | Supabase secret / service_role key. **Server only, never in client code or git** |

## Deploy (Vercel, free)

1. vercel.com → sign in with GitHub → **Add New → Project** → import this repo.
2. Under **Environment Variables**, add `GEMINI_API_KEY` (and the Supabase ones if used).
3. Deploy. Every push to `main` redeploys automatically.

## Code map

- `app/page.tsx` → `components/GraderApp.tsx`: app state, timer, calls to the API
- `components/SetupPanel.tsx`, `GradeView.tsx`, `AnalysisPanel.tsx`, `ResultsView.tsx`: the three screens
- `app/api/analyze`: one answer per request → `lib/ai.ts` (Gemini call, retry, errors) → `lib/analysis.ts` (validation)
- `lib/prompt.ts`: the AI instructions
- `app/api/sessions`, `app/api/answers`: optional Supabase saving (`lib/db.ts`)
- `lib/baseline.ts`: non-AI keyword matcher; `lib/mock.ts`: mock mode
- `DESIGN.md`: colours, fonts and shared classes (tokens in `app/globals.css`; brand book and logos in `design/`)

## Status: what is live, simulated, untested

- **Live:** setup, rubric parsing, AI analysis via Gemini, flags, grader scoring, timer, results, CSV export, optional Supabase saving.
- **Simulated:** mock mode only, when no key is set (clearly labeled in the UI).
- **Tested:** unit tests; full flow clicked through locally in mock mode; Gemini error path checked with an invalid key.
- **Not yet verified:** Gemini output quality on the sample (expected: S1 meets all, S2 thin/flagged, S3 wrong concept/flagged, S4 flagged for injected instruction); Supabase saving against a live project; behavior under free-tier rate limits with many testers.

## Decisions

- **Gemini as the AI provider:** free tier, team choice. Provider code is isolated in `lib/ai.ts`.
- **Supabase is optional:** the app works without it, so a missing key never blocks a demo. With it, sessions survive refresh via a `?s=<id>` link. No logins: anyone with a session link can open it, so **use fake data only**.
- **One answer per API request:** failures stay isolated, and requests stay under Vercel's time limit.
- **No AI score, ever:** the prompt forbids it, and the app has no field for one.
- **Python/Streamlit branch (`ta-grader`) not used:** it graded with AI-assigned scores, stored student names, and needed two servers plus Docker. Its Supabase idea and CSV export were carried over.

## Known limitations

- Typed text only. No handwriting or PDF upload yet.
- AI accuracy on nuanced writing is **unverified**. This is the biggest risk, which is why the human decides every score and borderline answers are flagged.
- Answers are sent to Google Gemini. Free-tier data may be used by Google to improve its products. **Use fake or anonymized data only** until a university privacy review.
- One question per session (start a new session for the next question).

*AI suggestions only. The grader decides every score. Do not enter real student names.*
