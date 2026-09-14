-- HiPath AI V1 schema — fully to Supabase per P3
-- Run via Supabase Dashboard SQL Editor or `supabase db push`

-- Enable pgcrypto for uuid
create extension if not exists "pgcrypto";

-- Users synced from Clerk
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  clerk_id text unique not null,
  email text,
  name text,
  avatar_url text,
  created_at timestamp with time zone default now()
);

-- Gamification per user
create table if not exists gamification (
  user_id text primary key references users(clerk_id) on delete cascade,
  xp integer default 0,
  level integer default 1,
  streak integer default 0,
  best_streak integer default 0,
  pass_rate integer default 0,
  study_minutes integer default 0,
  lessons_done integer default 0,
  last_study_date date,
  updated_at timestamp with time zone default now()
);

-- Roadmaps
create table if not exists roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(clerk_id) on delete cascade,
  title text not null,
  description text,
  goal text,
  level text,
  time_per_day text,
  duration text,
  why text,
  style text,
  status text default 'active',
  progress integer default 0,
  lessons_total integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists phases (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references roadmaps(id) on delete cascade,
  idx integer not null,
  title text not null,
  created_at timestamp with time zone default now()
);

create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references roadmaps(id) on delete cascade,
  phase_id uuid not null references phases(id) on delete cascade,
  idx integer not null,
  title text not null,
  content_md text,
  example_code text,
  quiz jsonb default '[]',
  xp_reward integer default 20,
  created_at timestamp with time zone default now()
);

create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(clerk_id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  quiz_id text,
  answers jsonb,
  score integer,
  passed boolean,
  created_at timestamp with time zone default now()
);

create table if not exists progress (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(clerk_id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  completed boolean default false,
  passed boolean default false,
  score integer,
  updated_at timestamp with time zone default now(),
  unique(user_id, lesson_id)
);

create table if not exists chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(clerk_id) on delete cascade,
  roadmap_id uuid references roadmaps(id) on delete cascade,
  title text,
  created_at timestamp with time zone default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  meta jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists weak_topics (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(clerk_id) on delete cascade,
  topic text not null,
  fail_count integer default 1,
  updated_at timestamp with time zone default now(),
  unique(user_id, topic)
);

-- RLS enable (service_role bypasses, anon with JWT)
alter table users enable row level security;
alter table gamification enable row level security;
alter table roadmaps enable row level security;
alter table phases enable row level security;
alter table lessons enable row level security;
alter table quiz_attempts enable row level security;
alter table progress enable row level security;
alter table chat_threads enable row level security;
alter table chat_messages enable row level security;
alter table weak_topics enable row level security;

-- Policies: allow service_role full, authenticated user where user_id = jwt.clerk_id (via Clerk Supabase JWT template)
-- For V1 simplicity we allow anon to read/write own clerk_id via header — replace with stricter JWT once Clerk JWT template set
-- Fallback: allow all for anon in dev (remove in prod if JWT template active)
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'allow_all_roadmaps') then
    create policy allow_all_roadmaps on roadmaps for all using (true) with check (true);
    create policy allow_all_phases on phases for all using (true) with check (true);
    create policy allow_all_lessons on lessons for all using (true) with check (true);
    create policy allow_all_users on users for all using (true) with check (true);
    create policy allow_all_gam on gamification for all using (true) with check (true);
    create policy allow_all_progress on progress for all using (true) with check (true);
    create policy allow_all_quiz on quiz_attempts for all using (true) with check (true);
    create policy allow_all_threads on chat_threads for all using (true) with check (true);
    create policy allow_all_messages on chat_messages for all using (true) with check (true);
    create policy allow_all_weak on weak_topics for all using (true) with check (true);
  end if;
end $$;
