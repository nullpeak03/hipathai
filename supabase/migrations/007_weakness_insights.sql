-- HiPath AI migration 007 — AI weakness insights history
-- Run via Supabase Dashboard SQL Editor or `supabase db push`
--
-- One row per remediation generated for a failed quiz (POST
-- /api/me/weakness-insight). weak_topics stays the aggregate counter;
-- this table is the per-event history behind dashboard chips and the
-- lesson fail panel. Server routes use the service-role key (bypasses
-- RLS); the authenticated policy below keeps the anon role denied while
-- allowing future JWT-based client access.

create table if not exists weakness_insights (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(clerk_id) on delete cascade,
  lesson_id uuid references lessons(id) on delete cascade,
  topic text not null,
  suggestion text not null,
  score integer,
  created_at timestamptz default now()
);

create index if not exists weakness_insights_user_idx
  on weakness_insights (user_id, created_at desc);

alter table weakness_insights enable row level security;

drop policy if exists weakness_insights_own on weakness_insights;
create policy weakness_insights_own on weakness_insights
  for all to authenticated
  using (user_id = (auth.jwt() ->> 'sub'))
  with check (user_id = (auth.jwt() ->> 'sub'));
