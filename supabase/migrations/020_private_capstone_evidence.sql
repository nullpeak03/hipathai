create table if not exists capstone_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(clerk_id) on delete cascade,
  roadmap_id uuid not null references roadmaps(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  project_summary text not null default '',
  repository_url text,
  deployment_url text,
  implementation_complete boolean not null default false,
  validation_complete boolean not null default false,
  documentation_complete boolean not null default false,
  reflection text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index if not exists capstone_evidence_roadmap_idx
  on capstone_evidence(user_id, roadmap_id, updated_at desc);

alter table capstone_evidence enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'capstone_evidence_owner'
      and tablename = 'capstone_evidence'
  ) then
    create policy capstone_evidence_owner on capstone_evidence
      for all to authenticated
      using (user_id = (auth.jwt() ->> 'sub'))
      with check (user_id = (auth.jwt() ->> 'sub'));
  end if;
end
$$;
