-- HiPath AI migration 002 — async job tracking for Inngest roadmap generation
-- Run via Supabase Dashboard SQL Editor or `supabase db push`
--
-- Written by: POST /api/roadmaps/async (creates "processing" row),
--             lib/inngest/functions.ts (marks "completed" / "failed"),
--             read by: GET /api/roadmaps/status/[jobId].
-- All access goes through server routes using the service-role key,
-- which bypasses RLS. No public policies are created here on purpose:
-- with RLS enabled and zero policies, anon/authenticated roles are
-- denied by default (closed table, service-role only).

create extension if not exists "pgcrypto";

create table if not exists async_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  error text,
  result jsonb,
  started_at timestamptz default now(),
  completed_at timestamptz
);

alter table async_jobs enable row level security;

-- Intentionally NO create policy statements:
-- RLS enabled + no policies = deny-all for anon/authenticated,
-- service_role bypasses RLS for the server routes above.
