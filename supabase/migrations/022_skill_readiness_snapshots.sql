create table if not exists skill_readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(clerk_id) on delete cascade,
  roadmap_id uuid not null references roadmaps(id) on delete cascade,
  snapshot jsonb not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, roadmap_id)
);

create index if not exists skill_readiness_snapshots_user_idx
  on skill_readiness_snapshots(user_id, completed_at desc);

alter table skill_readiness_snapshots enable row level security;
revoke all on skill_readiness_snapshots from anon, authenticated;
grant select, insert on skill_readiness_snapshots to service_role;
