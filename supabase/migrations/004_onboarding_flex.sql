-- 004: Onboarding flex — idempotency_key + future deadline is app-level, no DB change for deadline
alter table roadmaps add column if not exists idempotency_key text;
create index if not exists roadmaps_idempotency_idx on roadmaps(idempotency_key) where idempotency_key is not null;
create unique index if not exists roadmaps_user_idempotency_unique on roadmaps(user_id, idempotency_key) where idempotency_key is not null;
