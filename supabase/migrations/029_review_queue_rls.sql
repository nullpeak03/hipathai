-- Migration 029 — remove the permissive review-queue policies.
--
-- 016 granted `authenticated` SELECT and ALL on roadmap_review_queue with
-- `using (true)`, so anyone holding a Supabase-issued JWT could read every
-- queued roadmap (including other learners' unpublished drafts), approve or
-- reject them, or delete rows. No client ever uses a Supabase JWT today, so
-- the policies are dead weight — and a live landmine the moment direct
-- client access is added.
--
-- Every reader/writer goes through server routes with the service-role key,
-- which bypasses RLS. RLS stays enabled with zero policies = deny-all for
-- anon/authenticated.
--
-- Apply via Supabase Dashboard SQL Editor or `supabase db push`.

drop policy if exists roadmap_review_queue_read on roadmap_review_queue;
drop policy if exists roadmap_review_queue_write on roadmap_review_queue;
