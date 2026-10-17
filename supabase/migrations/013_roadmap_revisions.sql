-- 013: roadmap revisions + remedial phases for auto-replanning
create table if not exists roadmap_revisions (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references roadmaps(id) on delete cascade,
  user_id text not null references users(clerk_id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table roadmap_revisions enable row level security;

create policy "roadmap_revisions_owner" on roadmap_revisions
  for all using (user_id = (auth.jwt() ->> 'sub'))
  with check (user_id = (auth.jwt() ->> 'sub'));

create index if not exists roadmap_revisions_roadmap_idx on roadmap_revisions(roadmap_id, created_at desc);
