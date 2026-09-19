-- HiPath AI migration 006 — email reminder preference
-- Run via Supabase Dashboard SQL Editor or `supabase db push`
--
-- Opt-out flag for the daily streak-reminder cron. Defaults to true for
-- existing and new rows; the existing users_own RLS policy (FOR ALL on
-- users) already scopes access, so no new policy is needed.

alter table users add column if not exists email_reminders boolean not null default true;
