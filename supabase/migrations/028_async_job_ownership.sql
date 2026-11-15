-- Migration 028 — job ownership.
--
-- GET /api/roadmaps/status/[jobId] accepted any signed-in caller and read
-- (and could write) the job row before checking who owned it. Job ids are
-- random UUIDs, but they appear in URLs, logs, and screenshots, so the
-- endpoint must not rely on unguessability.
--
-- Ownership is recorded at creation time from here on. Older rows are
-- backfilled where the roadmap/lesson they reference still exists; the route
-- falls back to that join when `user_id` is null.
--
-- Apply via Supabase Dashboard SQL Editor or `supabase db push`.

alter table async_jobs add column if not exists user_id text;

create index if not exists async_jobs_user_started_idx
  on async_jobs (user_id, started_at desc);

-- Roadmap jobs use the roadmap id as the job id.
update async_jobs j
   set user_id = r.user_id
  from roadmaps r
 where r.id = j.id
   and j.user_id is null;

-- Lesson-content and quiz jobs carry result.lessonId.
update async_jobs j
   set user_id = r.user_id
  from lessons l
  join roadmaps r on r.id = l.roadmap_id
 where j.user_id is null
   and l.id = (
     case
       when (j.result ->> 'lessonId') ~ '^[0-9a-fA-F-]{36}$'
       then (j.result ->> 'lessonId')::uuid
     end
   );
