-- HiPath AI v1 — Production Ready Schema (fresh DB)
-- Wipeout recovery: run this ONE file in Supabase SQL editor (it is idempotent)
-- Auth owner is Clerk (users.clerk_id); Supabase holds app data only.
-- Requires: Clerk JWT template "supabase" with sub={{user.id}} (Dashboard > JWT Templates)

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- 1. users
create table if not exists users (
  clerk_id text primary key,
  track text,
  level text,
  stack text[] default '{}',
  hrs_per_day int check (hrs_per_day between 1 and 12),
  deadline date check (deadline is null or deadline > CURRENT_DATE),
  days_per_week int check (days_per_week between 2 and 7),
  session_min int check (session_min in (15,30,60,90,120)),
  style text check (style in ('video-first','reading-first','project-first','mixed')),
  draft jsonb,
  settings jsonb default '{}',
  display_name text,
  xp int default 0,
  streak int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists users_created_idx on users(created_at desc);

-- 2. roadmaps
create table if not exists roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(clerk_id) on delete cascade,
  status text not null default 'generating' check (status in ('generating','ready','failed','archived')),
  version int not null default 1,
  goal text,
  title text,
  total_weeks int check (total_weeks between 1 and 52),
  draft jsonb,
  nodes jsonb default '[]',
  idempotency_key text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists roadmaps_user_idx on roadmaps(user_id, created_at desc);
create index if not exists roadmaps_user_status_idx on roadmaps(user_id, status, created_at desc);
create index if not exists roadmaps_idempotency_idx on roadmaps(idempotency_key) where idempotency_key is not null;
create unique index if not exists roadmaps_user_idempotency_unique on roadmaps(user_id, idempotency_key) where idempotency_key is not null;

-- 3. progress_events
create table if not exists progress_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(clerk_id) on delete cascade,
  node_order int,
  type text not null check (type in ('quiz','project','lesson')),
  score int check (score between 0 and 100),
  ts timestamptz default now()
);
create index if not exists progress_events_user_ts_idx on progress_events(user_id, ts desc);
create index if not exists progress_events_user_type_idx on progress_events(user_id, type);
create index if not exists progress_events_user_node_type_idx on progress_events(user_id, node_order, type, ts desc);

-- 4. tutor_threads
create table if not exists tutor_threads (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(clerk_id) on delete cascade,
  roadmap_id uuid references roadmaps(id) on delete set null,
  node_order int,
  title text,
  language text default 'python' check (language in ('python','javascript','typescript','java','go','rust','c','cpp','csharp','php','ruby','swift','kotlin','bash','sql')),
  messages jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists tutor_threads_user_node_idx on tutor_threads(user_id, node_order);
create index if not exists tutor_threads_user_updated_idx on tutor_threads(user_id, updated_at desc);
create index if not exists tutor_threads_user_roadmap_idx on tutor_threads(user_id, roadmap_id, node_order);
create index if not exists tutor_threads_title_trgm_idx on tutor_threads using gin (title gin_trgm_ops);

-- 5. ai_logs
create table if not exists ai_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  task text check (task in ('roadmap','lesson','quiz','tutor','review','summary','run')),
  provider text,
  latency_ms int check (latency_ms >= 0),
  fallback_used boolean default false,
  error_code text,
  tokens int check (tokens is null or tokens >= 0),
  ts timestamptz default now()
);
create index if not exists ai_logs_user_ts_idx on ai_logs(user_id, ts desc);

-- 6. rate_limits (Supabase-backed, replaces in-memory Maps)
create table if not exists rate_limits (
  user_id text not null,
  window_type text not null check (window_type in ('ai_day','roadmap_week','tutor_day')),
  count int not null default 0,
  reset_at timestamptz not null,
  primary key (user_id, window_type)
);

-- Updated_at triggers
create or replace function set_updated_at() returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists users_updated_at on users;
create trigger users_updated_at before update on users for each row execute function set_updated_at();
drop trigger if exists roadmaps_updated_at on roadmaps;
create trigger roadmaps_updated_at before update on roadmaps for each row execute function set_updated_at();
drop trigger if exists tutor_threads_updated_at on tutor_threads;
create trigger tutor_threads_updated_at before update on tutor_threads for each row execute function set_updated_at();

-- RLS: enable
alter table users enable row level security;
alter table roadmaps enable row level security;
alter table progress_events enable row level security;
alter table tutor_threads enable row level security;
alter table ai_logs enable row level security;
alter table rate_limits enable row level security;

-- RLS: policies (require Clerk JWT template "supabase" with sub = Clerk userId)
-- service_role bypasses RLS, so server routes via serviceClient still work.
-- For anon/browser, only own rows are visible via auth.jwt()->>'sub'
drop policy if exists "clerk_owns_users" on users;
create policy "clerk_owns_users" on users for all using (auth.jwt()->>'sub' = clerk_id) with check (auth.jwt()->>'sub' = clerk_id);
drop policy if exists "clerk_owns_roadmaps" on roadmaps;
create policy "clerk_owns_roadmaps" on roadmaps for all using (auth.jwt()->>'sub' = user_id) with check (auth.jwt()->>'sub' = user_id);
drop policy if exists "clerk_owns_progress" on progress_events;
create policy "clerk_owns_progress" on progress_events for all using (auth.jwt()->>'sub' = user_id) with check (auth.jwt()->>'sub' = user_id);
drop policy if exists "clerk_owns_threads" on tutor_threads;
create policy "clerk_owns_threads" on tutor_threads for all using (auth.jwt()->>'sub' = user_id) with check (auth.jwt()->>'sub' = user_id);
drop policy if exists "clerk_owns_logs" on ai_logs;
create policy "clerk_owns_logs" on ai_logs for all using (auth.jwt()->>'sub' = user_id) with check (auth.jwt()->>'sub' = user_id);
drop policy if exists "clerk_owns_rate" on rate_limits;
create policy "clerk_owns_rate" on rate_limits for all using (auth.jwt()->>'sub' = user_id) with check (auth.jwt()->>'sub' = user_id);

-- One-time heal for old stuck generating (Hobby 10s bug)
update roadmaps set status = 'failed' where status = 'generating' and created_at < now() - interval '5 minutes';
