-- HiPath AI migration 008 — structured lesson content
-- Run via Supabase Dashboard SQL Editor or `supabase db push`
--
-- lessons.content_json holds the validated block document produced by the
-- lesson worker (see lib/lesson-content-blocks.ts). Nullable on purpose:
-- older lessons keep rendering from content_md, and the lesson page prefers
-- content_json only when present. No backfill — regeneration upgrades rows.

alter table lessons add column if not exists content_json jsonb;
