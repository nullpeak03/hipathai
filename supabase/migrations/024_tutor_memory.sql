-- HiPath AI migration 024 — tutor memory (cross-thread)
create table if not exists tutor_memory (
  user_id text primary key references users(clerk_id) on delete cascade,
  summary text not null default '',
  updated_at timestamptz not null default now()
);

alter table tutor_memory enable row level security;

drop policy if exists tutor_memory_read_own on tutor_memory;
create policy tutor_memory_read_own on tutor_memory
  for select to authenticated using (user_id = (auth.jwt() ->> 'sub'));

-- Writes are service-role only.
revoke all on table tutor_memory from anon, authenticated;
" path="/home/hirdendra/Desktop/Hipath AI/supabase/migrations/024_tutor_memory.sql">
EOF