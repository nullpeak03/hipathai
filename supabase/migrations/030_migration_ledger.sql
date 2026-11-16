-- Migration 030 — an applied-migration ledger.
--
-- Why: 026–029 were applied over the direct Postgres connection, which the
-- Supabase SQL editor history does not record (it only lists statements typed
-- into the editor). The project therefore *looked* stuck at 025 even though the
-- objects existed. There was no way to ask the database "am I current?".
--
-- This table is that answer. `scripts/migrations.mjs` compares it with
-- `supabase/migrations/*.sql`:
--
--   npm run migrations:status   # exit 1 when behind or when an applied file changed
--   npm run migrations:record   # fill in checksums / backfill rows
--
-- Apply via the Supabase Dashboard SQL Editor or `supabase db push`.
--
-- The backfill below lists every migration that already exists in production.
-- Checksums are filled in by `migrations:record`; a missing checksum means
-- "applied, contents not yet verified", never "not applied".

create table if not exists public.schema_migrations (
  version    text primary key,
  name       text not null,
  checksum   text,
  applied_at timestamptz not null default now(),
  applied_by text not null default current_user
);

comment on table public.schema_migrations is
  'Applied migrations, one row per supabase/migrations/*.sql file. Written by SQL migrations and scripts/migrations.mjs.';
comment on column public.schema_migrations.checksum is
  'sha256 of the migration file when it was recorded; non-null values detect edits to applied files.';

-- Server-only: RLS enabled with no policies denies anon/authenticated, while
-- the service role bypasses RLS (same pattern as migration 029).
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
grant select, insert, update on public.schema_migrations to service_role;

-- Backfill: everything applied before this ledger existed.
insert into public.schema_migrations (version, name)
values
  ('001', '001_hipath.sql'),
  ('002', '002_jobs.sql'),
  ('003', '003_secure_rls.sql'),
  ('004', '004_activity.sql'),
  ('005', '005_review_schedule.sql'),
  ('006', '006_preferences.sql'),
  ('007', '007_weakness_insights.sql'),
  ('008', '008_lesson_content_json.sql'),
  ('009', '009_effective_learning.sql'),
  ('010a', '010a_rate_limits.sql'),
  ('010b', '010b_tutor_images.sql'),
  ('011', '011_public_roadmaps.sql'),
  ('012', '012_pro_entitlement.sql'),
  ('013', '013_roadmap_revisions.sql'),
  ('014', '014_v2_mastery.sql'),
  ('015', '015_public_roadmap_topics.sql'),
  ('016', '016_review_queue.sql'),
  ('017', '017_user_preferences.sql'),
  ('018', '018_authoritative_assessments.sql'),
  ('019', '019_adaptive_replan_proposals.sql'),
  ('020', '020_private_capstone_evidence.sql'),
  ('021', '021_pro_waitlist.sql'),
  ('022', '022_skill_readiness_snapshots.sql'),
  ('023', '023_private_tutor_images.sql'),
  ('024', '024_tutor_memory.sql'),
  ('025', '025_phase_exam_retake_safety.sql'),
  ('026', '026_atomic_rate_limit.sql'),
  ('027', '027_tutor_image_limits.sql'),
  ('028', '028_async_job_ownership.sql'),
  ('029', '029_review_queue_rls.sql'),
  ('030', '030_migration_ledger.sql')
on conflict (version) do nothing;
