-- 002: indexes + RLS fix for v1 (run in Supabase SQL editor)
-- Fix for: hasRoadmap blocked by RLS, analytics slow, stuck generating heals

-- Extensions (gen_random_uuid already works on Supabase, but ensure)
create extension if not exists "pgcrypto";

-- Performance indexes (missing in 001)
create index if not exists ai_logs_user_ts_idx on ai_logs(user_id, ts desc);
create index if not exists progress_events_user_ts_idx on progress_events(user_id, ts desc);
create index if not exists progress_events_user_type_idx on progress_events(user_id, type);
create index if not exists tutor_threads_user_node_idx on tutor_threads(user_id, node_order);
create index if not exists users_created_idx on users(created_at desc);

-- Heal any roadmaps stuck in `generating` > 5 min (from the Hobby timeout bug before 2026-09-09)
-- They will be lazily healed by the API, but this one-time fix cleans the table now.
-- No template nodes needed here — just mark as `failed` so UI shows Retry, not infinite spinner.
update roadmaps set status = 'failed'
where status = 'generating' and created_at < now() - interval '5 minutes';

-- RLS fix: keep service_role bypass, but allow anon to read nothing (current behavior is correct for now).
-- When Clerk JWT template is wired (M5), replace with:
--   create policy "clerk_owns_row" on roadmaps for all using (auth.jwt()->>'sub' = user_id);
-- For now, ensure at least service_role can always read (it bypasses, but be explicit)
-- No new policies needed — just document that hasRoadmap now uses serviceClient (see lib/hasRoadmap.ts)

-- Optional: add updated_at trigger for roadmaps (useful for polling)
alter table roadmaps add column if not exists updated_at timestamptz default now();
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists roadmaps_updated_at on roadmaps;
create trigger roadmaps_updated_at before update on roadmaps for each row execute function set_updated_at();
