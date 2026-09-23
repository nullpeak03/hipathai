-- Migration 009: Effective learning — quiz bank, lesson estimates, prerequisites, phase exam progress
-- Extends lessons with quiz_bank (canonical 10-Q bank), estimated_minutes, prerequisites
-- Adds phase_exam_progress for gated phase mastery

-- Quiz bank: canonical 10-question bank, distinct from ephemeral samples
alter table lessons add column if not exists quiz_bank jsonb;
-- Backfill existing banks: copy quiz where plausible bank
update lessons set quiz_bank = quiz where quiz_bank is null and quiz is not null and jsonb_array_length(quiz) >= 8;

-- Estimated minutes per lesson (~5-20, derived from intensity)
alter table lessons add column if not exists estimated_minutes integer;

-- Prerequisites DAG: lesson IDs that must be passed before this lesson unlocks
alter table lessons add column if not exists prerequisites jsonb default '[]';

-- Phase exam progress for gated mastery
create table if not exists phase_exam_progress (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(clerk_id) on delete cascade,
  phase_id uuid not null references phases(id) on delete cascade,
  passed boolean not null default false,
  score integer,
  attempts integer not null default 1,
  updated_at timestamptz default now(),
  unique(user_id, phase_id)
);
create index if not exists idx_phase_exam_progress_user on phase_exam_progress(user_id);
alter table phase_exam_progress enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'phase_exam_own' and tablename = 'phase_exam_progress') then
    create policy phase_exam_own on phase_exam_progress for all to authenticated using (user_id = (auth.jwt() ->> 'sub')) with check (user_id = (auth.jwt() ->> 'sub'));
  end if;
end $$;
