-- Readable views for the team. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Then open them in Table Editor (they appear next to the tables).
-- security_invoker = true keeps Row Level Security in force, so the public key still can't read them.

-- One row per grading session (one question graded in one sitting).
create or replace view session_summary with (security_invoker = true) as
select
  (s.created_at at time zone 'America/New_York')::timestamp(0) as started_eastern,
  left(s.question, 80) as question,
  count(a.id) as answers,
  count(a.final_score) as scored,
  round(avg(a.seconds_spent) filter (where a.final_score is not null)) as avg_seconds_per_scored_answer,
  count(a.id) filter (where (a.analysis->>'flag')::boolean) as ai_flagged,
  count(a.id) filter (where a.analysis is null) as ai_not_analyzed,
  s.id as session_id
from grading_sessions s
left join answers a on a.session_id = s.id
group by s.id
order by s.created_at desc;

-- One row per answer, grouped by session, newest session first.
create or replace view answer_overview with (security_invoker = true) as
select
  (s.created_at at time zone 'America/New_York')::timestamp(0) as session_started_eastern,
  left(s.question, 60) as question,
  a.label as answer,
  a.final_score,
  (select sum((c->>'points')::numeric) from jsonb_array_elements(s.criteria) c) as max_points,
  a.seconds_spent,
  (a.analysis->>'flag')::boolean as ai_flagged,
  a.analysis->>'flagReason' as ai_flag_reason,
  a.analysis->>'confidence' as ai_confidence,
  a.grader_note,
  a.session_id
from answers a
join grading_sessions s on s.id = a.session_id
order by s.created_at desc, a.position;

revoke all on session_summary, answer_overview from anon, authenticated;
