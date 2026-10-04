-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists grading_sessions (
  id uuid primary key,
  created_at timestamptz not null default now(),
  question text not null,
  rubric_text text not null,
  criteria jsonb not null
);

create table if not exists answers (
  id uuid primary key,
  session_id uuid not null references grading_sessions(id) on delete cascade,
  label text not null,          -- anonymous label: S1, S2, ...
  position int not null,
  text text not null,
  analysis jsonb,               -- AI highlights (never a score)
  final_score numeric,          -- set only by the grader
  grader_note text,
  seconds_spent int not null default 0,
  scored_at timestamptz
);

create index if not exists answers_session_idx on answers(session_id);

-- Row Level Security on with no policies: the public (anon) key can't read or
-- write anything. Only the server, using the secret key, can.
alter table grading_sessions enable row level security;
alter table answers enable row level security;
