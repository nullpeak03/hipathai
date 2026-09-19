-- HiPath AI migration 005 — spaced-repetition review schedule
-- Run via Supabase Dashboard SQL Editor or `supabase db push`
--
-- One row per user per lesson, maintained by POST /api/me/quiz-attempt:
-- failure (re)schedules a review for tomorrow with repetitions reset;
-- each consecutive pass advances through expanding intervals
-- (3d, 7d, 14d, 30d). Read by GET /api/me/reviews for the dashboard
-- "Due for review" card. Server routes use the service-role key
-- (bypasses RLS); the authenticated policy below keeps the anon role
-- denied while allowing future JWT-based client access.

create table if not exists review_schedule (
  user_id text not null references users(clerk_id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  topic text not null,
  interval_days integer not null default 1,
  repetitions integer not null default 0,
  next_review_at date not null default CURRENT_DATE,
  last_score integer,
  updated_at timestamptz default now(),
  primary key (user_id, lesson_id)
);

create index if not exists review_schedule_due_idx
  on review_schedule (user_id, next_review_at);

alter table review_schedule enable row level security;

drop policy if exists review_schedule_own on review_schedule;
create policy review_schedule_own on review_schedule
  for all to authenticated
  using (user_id = (auth.jwt() ->> 'sub'))
  with check (user_id = (auth.jwt() ->> 'sub'));
