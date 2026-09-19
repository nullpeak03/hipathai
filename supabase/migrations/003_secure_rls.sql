-- HiPath AI migration 003 — lock down Row Level Security
-- Run via Supabase Dashboard SQL Editor or `supabase db push`
--
-- Background: migration 001 created permissive `allow_all_*` policies
-- (USING (true) WITH CHECK (true)) so any holder of the anon key could
-- read/write EVERY user's roadmaps, lessons, progress, and chats.
-- This migration drops those policies and replaces them with
-- Clerk-JWT-scoped policies: each row is visible only when its owner
-- id matches the request JWT's `sub` claim (Clerk's Supabase JWT
-- template sets sub = Clerk user ID, which is what we store in
-- users.clerk_id / <table>.user_id).
--
-- Notes:
-- - Server routes + Inngest functions use the service-role key, which
--   bypasses RLS entirely, so background writes keep working.
-- - No policies are granted to `anon`: unauthenticated requests are
--   denied by default. Authenticated app users get own-rows-only access.
-- - Child tables without a user_id (phases, lessons, chat_messages)
--   are scoped via EXISTS checks against their parent roadmap/thread.
-- - async_jobs (migration 002) intentionally keeps zero public policies
--   (service-role only) because it has no user_id column.

-- ── 1. Drop the insecure open policies from 001 ──────────────────────
drop policy if exists allow_all_users on users;
drop policy if exists allow_all_gam on gamification;
drop policy if exists allow_all_roadmaps on roadmaps;
drop policy if exists allow_all_phases on phases;
drop policy if exists allow_all_lessons on lessons;
drop policy if exists allow_all_quiz on quiz_attempts;
drop policy if exists allow_all_progress on progress;
drop policy if exists allow_all_threads on chat_threads;
drop policy if exists allow_all_messages on chat_messages;
drop policy if exists allow_all_weak on weak_topics;

-- ── 2. Scoped policies (re-runnable: drop-then-create) ───────────────

-- users: a signed-in user sees/edits only their own row (matched on clerk_id)
drop policy if exists users_own on users;
create policy users_own on users
  for all to authenticated
  using (clerk_id = (auth.jwt() ->> 'sub'))
  with check (clerk_id = (auth.jwt() ->> 'sub'));

-- gamification: PK is user_id (Clerk ID)
drop policy if exists gamification_own on gamification;
create policy gamification_own on gamification
  for all to authenticated
  using (user_id = (auth.jwt() ->> 'sub'))
  with check (user_id = (auth.jwt() ->> 'sub'));

-- roadmaps: direct owner column
drop policy if exists roadmaps_own on roadmaps;
create policy roadmaps_own on roadmaps
  for all to authenticated
  using (user_id = (auth.jwt() ->> 'sub'))
  with check (user_id = (auth.jwt() ->> 'sub'));

-- phases: scoped through the parent roadmap's owner
drop policy if exists phases_via_roadmap on phases;
create policy phases_via_roadmap on phases
  for all to authenticated
  using (exists (
    select 1 from roadmaps r
    where r.id = phases.roadmap_id
      and r.user_id = (auth.jwt() ->> 'sub')
  ))
  with check (exists (
    select 1 from roadmaps r
    where r.id = phases.roadmap_id
      and r.user_id = (auth.jwt() ->> 'sub')
  ));

-- lessons: scoped through the parent roadmap's owner
drop policy if exists lessons_via_roadmap on lessons;
create policy lessons_via_roadmap on lessons
  for all to authenticated
  using (exists (
    select 1 from roadmaps r
    where r.id = lessons.roadmap_id
      and r.user_id = (auth.jwt() ->> 'sub')
  ))
  with check (exists (
    select 1 from roadmaps r
    where r.id = lessons.roadmap_id
      and r.user_id = (auth.jwt() ->> 'sub')
  ));

-- quiz_attempts / progress / chat_threads / weak_topics: direct owner column
drop policy if exists quiz_attempts_own on quiz_attempts;
create policy quiz_attempts_own on quiz_attempts
  for all to authenticated
  using (user_id = (auth.jwt() ->> 'sub'))
  with check (user_id = (auth.jwt() ->> 'sub'));

drop policy if exists progress_own on progress;
create policy progress_own on progress
  for all to authenticated
  using (user_id = (auth.jwt() ->> 'sub'))
  with check (user_id = (auth.jwt() ->> 'sub'));

drop policy if exists chat_threads_own on chat_threads;
create policy chat_threads_own on chat_threads
  for all to authenticated
  using (user_id = (auth.jwt() ->> 'sub'))
  with check (user_id = (auth.jwt() ->> 'sub'));

drop policy if exists weak_topics_own on weak_topics;
create policy weak_topics_own on weak_topics
  for all to authenticated
  using (user_id = (auth.jwt() ->> 'sub'))
  with check (user_id = (auth.jwt() ->> 'sub'));

-- chat_messages: scoped through the parent thread's owner
drop policy if exists chat_messages_via_thread on chat_messages;
create policy chat_messages_via_thread on chat_messages
  for all to authenticated
  using (exists (
    select 1 from chat_threads t
    where t.id = chat_messages.thread_id
      and t.user_id = (auth.jwt() ->> 'sub')
  ))
  with check (exists (
    select 1 from chat_threads t
    where t.id = chat_messages.thread_id
      and t.user_id = (auth.jwt() ->> 'sub')
  ));
