# TA Grader design system

The full brand book is `design/TA-Grader-Design-System.pdf`. Tokens live in `design/tokens.json` and are wired into the app in `app/globals.css`.

## In one line

A quiet, organized desk: plain words, clean screens, no hype. The AI highlights; the grader decides every score.

## Using the tokens

Use the semantic Tailwind utilities below. Do not use raw palette colours (`slate-*`, `emerald-*`, `amber-*`, `red-*`, `sky-*`): they won't follow the dark theme.

| Utility suffix | Use for |
| --- | --- |
| `paper` | Page background |
| `surface` | Cards, inputs, list rows (`.card` = surface + line border + radius-lg) |
| `sunken` | Quiet panels, chips, timer pill, table header |
| `line` | Hairline borders and dividers |
| `control` | Borders of inputs and secondary buttons |
| `ink` / `ink-muted` | Body text / secondary text |
| `primary`, `primary-hover`, `on-primary` | The one main action per view, selection, the score form frame, the toast |
| `marker` | Brand yellow (logo, empty states). Never text, never a status |
| `highlight`, `highlight-rule` | Only for the student's own words quoted as evidence (`.evidence`) |
| `met`, `met-bg` | "Met", scored, progress |
| `partial`, `partial-bg` | "Partly met", medium confidence |
| `flag`, `flag-bg` | "Needs a closer look", low confidence (`.callout-flag`) |
| `danger`, `danger-bg` | Something failed (`.callout-danger`) |
| `focus` | Focus ring (applied globally) |

Example: `bg-surface text-ink border-line`, `bg-primary text-on-primary hover:bg-primary-hover`.

Dark mode ("late night") follows the OS setting until the grader picks a theme with the header toggle (`components/ThemeToggle.tsx`). The choice is saved in the browser and applied as `data-theme="dark"` or `data-theme="light"` on `<html>`.

## Type

- `font-serif` (Newsreader): the wordmark, screen titles, the question, and student answers.
- `font-sans` (Public Sans, default): the interface.
- `font-mono` (IBM Plex Mono): timers, rubric lines, answer IDs (S1, S2…), scores.

Fonts are bundled in `app/fonts` (SIL Open Font License) and loaded with `next/font/local`.

## Shape and space

Radii: `rounded-sm` 4px (badges, chips), `rounded-md` 8px (buttons, inputs, callouts), `rounded-lg` 12px (cards, panels). One shadow, `shadow-float`, for the toast only. 4px spacing grid.

## Shared classes (`app/globals.css`)

`.btn-primary`, `.btn-secondary`, `.input`, `.label`, `.hint`, `.card`, `.evidence`, `.callout` + `.callout-flag` / `.callout-info` / `.callout-danger`.

## Writing

- Address the grader as "you". The AI is "the AI".
- Sentence case. Verbs on buttons ("Start grading 4 answers").
- Numbers over adjectives ("3 flagged", "0:49 per answer").
- Say "suggestions", "highlights", "flags". Never "AI score" or "auto-grade".
- Errors say what happened and what still works.
- No emoji. Glyphs (✓ ⚠ ⏱ ⬆) always sit next to a word.

## Logo

`public/logo-mark.svg` (light) and `public/logo-mark-dark.svg` (dark); full lockups and wordmark in `design/`. `app/icon.svg` is the favicon. Don't recolour, stretch or re-set the name in another font.
