-- HiPath AI v1 schema (run in Supabase SQL editor)
-- Auth owner is Clerk (users.clerk_id); Supabase holds app data only.

create table if not exists users (
  clerk_id text primary key,
  track text,
  level text,
  stack text[] default '{}',
  hrs_per_day int,
  deadline date,
  days_per_week int,
  session_min int,
  style text,
  draft jsonb,
  xp int default 0,
  streak int default 0,
  created_at timestamptz default now()
);

create table if not exists roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(clerk_id) on delete cascade,
  status text not null default 'generating' check (status in ('generating','ready','failed','archived')),
  version int not null default 1,
  goal text,
  title text,
  total_weeks int,
  draft jsonb,
  nodes jsonb default '[]',
  created_at timestamptz default now()
);
create index if not exists roadmaps_user_idx on roadmaps(user_id, created_at desc);

create table if not exists progress_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(clerk_id) on delete cascade,
  node_order int,
  type text not null,
  score int,
  ts timestamptz default now()
);

create table if not exists tutor_threads (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(clerk_id) on delete cascade,
  node_order int,
  messages jsonb default '[]',
  created_at timestamptz default now()
);

create table if not exists ai_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  task text,
  provider text,
  latency_ms int,
  fallback_used boolean default false,
  error_code text,
  tokens int,
  ts timestamptz default now()
);

-- RLS: service_role (server routes) bypasses; anon gets nothing until JWT template wired (M5).
alter table users enable row level security;
alter table roadmaps enable row level security;
alter table progress_events enable row level security;
alter table tutor_threads enable row level security;
alter table ai_logs enable row level security;
