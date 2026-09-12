-- 005: Production hardening (idempotent, safe to run after wipeout)
-- Run after schema.sql on a fresh DB, or as incremental migration.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- Ensure columns from 003/004 exist (for DBs that only ran schema.sql before)
alter table tutor_threads add column if not exists title text;
alter table tutor_threads add column if not exists roadmap_id uuid references roadmaps(id) on delete set null;
alter table tutor_threads add column if not exists language text default 'python';
alter table tutor_threads add column if not exists updated_at timestamptz default now();
alter table roadmaps add column if not exists idempotency_key text;
alter table roadmaps add column if not exists updated_at timestamptz default now();
alter table users add column if not exists settings jsonb default '{}';
alter table users add column if not exists display_name text;
alter table users add column if not exists updated_at timestamptz default now();

-- Backfill titles
update tutor_threads set title = left((messages->0->>'content')::text, 40) where title is null and jsonb_array_length(messages) > 0;

-- Indexes
create index if not exists roadmaps_user_status_idx on roadmaps(user_id, status, created_at desc);
create index if not exists tutor_threads_user_updated_idx on tutor_threads(user_id, updated_at desc);
create index if not exists tutor_threads_title_trgm_idx on tutor_threads using gin (title gin_trgm_ops);
create unique index if not exists roadmaps_user_idempotency_unique on roadmaps(user_id, idempotency_key) where idempotency_key is not null;

-- rate_limits table (if not already from schema.sql)
create table if not exists rate_limits (
  user_id text not null,
  window_type text not null check (window_type in ('ai_day','roadmap_week','tutor_day')),
  count int not null default 0,
  reset_at timestamptz not null,
  primary key (user_id, window_type)
);
alter table rate_limits enable row level security;
drop policy if exists "clerk_owns_rate" on rate_limits;
create policy "clerk_owns_rate" on rate_limits for all using (auth.jwt()->>'sub' = user_id) with check (auth.jwt()->>'sub' = user_id);

-- Triggers
create or replace function set_updated_at() returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists tutor_threads_updated_at on tutor_threads;
create trigger tutor_threads_updated_at before update on tutor_threads for each row execute function set_updated_at();
drop trigger if exists users_updated_at on users;
create trigger users_updated_at before update on users for each row execute function set_updated_at();

-- RLS policies (require Clerk JWT template "supabase")
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

-- Heal stuck generating
update roadmaps set status = 'failed' where status = 'generating' and created_at < now() - interval '5 minutes';
