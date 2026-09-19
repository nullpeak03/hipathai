-- HiPath AI migration 004 — daily study activity (analytics heatmap)
-- Run via Supabase Dashboard SQL Editor or `supabase db push`
--
-- One row per user per day, incremented by POST /api/me/study with real
-- lesson dwell time. Read by GET /api/me/daily-activity for the analytics
-- heatmap and dashboard week-over-week stats. Server routes use the
-- service-role key (bypasses RLS); the authenticated policy below keeps
-- the anon role denied while allowing future JWT-based client access.

create table if not exists daily_activity (
  user_id text not null references users(clerk_id) on delete cascade,
  activity_date date not null default CURRENT_DATE,
  minutes integer not null default 0,
  xp_earned integer not null default 0,
  lessons_completed integer not null default 0,
  updated_at timestamptz default now(),
  primary key (user_id, activity_date)
);

alter table daily_activity enable row level security;

drop policy if exists daily_activity_own on daily_activity;
create policy daily_activity_own on daily_activity
  for all to authenticated
  using (user_id = (auth.jwt() ->> 'sub'))
  with check (user_id = (auth.jwt() ->> 'sub'));
