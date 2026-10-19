-- Migration 016: manual review queue for public roadmap publishing
create table if not exists roadmap_review_queue (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references roadmaps(id) on delete cascade,
  user_id text not null references users(clerk_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','published')),
  reason text,
  reviewer_id text references users(clerk_id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists roadmap_review_queue_status_idx on roadmap_review_queue(status, created_at desc);

alter table roadmap_review_queue enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'roadmap_review_queue_read' and tablename = 'roadmap_review_queue') then
    create policy roadmap_review_queue_read on roadmap_review_queue
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'roadmap_review_queue_write' and tablename = 'roadmap_review_queue') then
    create policy roadmap_review_queue_write on roadmap_review_queue
      for all to authenticated using (true) with check (true);
  end if;
end $$;
