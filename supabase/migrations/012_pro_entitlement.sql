-- HiPath AI migration 012 — Pro entitlement flag (code runner paywall).
-- Everyone defaults to free; grant manually until billing ships:
--   update users set is_pro = true where clerk_id = '<CLERK_ID>';
-- Apply via Supabase Dashboard SQL Editor.

alter table users add column if not exists is_pro boolean not null default false;
