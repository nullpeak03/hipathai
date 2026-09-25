-- HiPath AI migration 010 — persistent sliding-window rate limiting.
-- In-memory buckets reset on every serverless cold start, so limits were
-- per-instance and bypassable. Hits now persist here (service-role only);
-- the app falls back to memory when the table is unreachable.
-- Apply via Supabase Dashboard SQL Editor.

create table if not exists rate_limit_hits (
  id bigint generated always as identity primary key,
  key text not null,
  ts timestamptz not null default now()
);

create index if not exists rate_limit_hits_key_ts on rate_limit_hits (key, ts);

alter table rate_limit_hits enable row level security;

-- Intentionally NO policies: RLS enabled + no policies = deny-all for
-- anon/authenticated, service_role bypasses for the server routes.
