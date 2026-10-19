-- Migration 014: V2 learner mastery, skill graph, and replan proposals

create table if not exists learner_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(clerk_id) on delete cascade,
  roadmap_id uuid references roadmaps(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete cascade,
  topic text not null,
  mastery_score numeric not null default 0 check (mastery_score >= 0 and mastery_score <= 100),
  attempts integer not null default 0,
  last_practiced_at timestamptz,
  decay_rate numeric not null default 0.05,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, roadmap_id, topic)
);

create index if not exists learner_mastery_user_idx on learner_mastery(user_id, updated_at desc);
create index if not exists learner_mastery_roadmap_idx on learner_mastery(roadmap_id, topic);

alter table learner_mastery enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'learner_mastery_own' and tablename = 'learner_mastery') then
    create policy learner_mastery_own on learner_mastery
      for all to authenticated
      using (user_id = (auth.jwt() ->> 'sub'))
      with check (user_id = (auth.jwt() ->> 'sub'));
  end if;
end $$;

create table if not exists skill_nodes (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references roadmaps(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete cascade,
  topic text not null,
  difficulty text,
  prerequisites jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (roadmap_id, topic)
);

create index if not exists skill_nodes_roadmap_idx on skill_nodes(roadmap_id);

alter table skill_nodes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'skill_nodes_owner' and tablename = 'skill_nodes') then
    create policy skill_nodes_owner on skill_nodes
      for all to authenticated
      using (exists (
        select 1 from roadmaps r
        where r.id = skill_nodes.roadmap_id
          and r.user_id = (auth.jwt() ->> 'sub')
      ))
      with check (exists (
        select 1 from roadmaps r
        where r.id = skill_nodes.roadmap_id
          and r.user_id = (auth.jwt() ->> 'sub')
      ));
  end if;
end $$;

create table if not exists replan_proposals (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references roadmaps(id) on delete cascade,
  user_id text not null references users(clerk_id) on delete cascade,
  reason text not null,
  proposed_changes jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'applied')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists replan_proposals_roadmap_idx on replan_proposals(roadmap_id, created_at desc);

alter table replan_proposals enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'replan_proposals_owner' and tablename = 'replan_proposals') then
    create policy replan_proposals_owner on replan_proposals
      for all to authenticated
      using (user_id = (auth.jwt() ->> 'sub'))
      with check (user_id = (auth.jwt() ->> 'sub'));
  end if;
end $$;
