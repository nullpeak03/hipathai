-- 003: Tutor modern — titles, roadmap_id, language, updated_at
alter table tutor_threads add column if not exists title text;
alter table tutor_threads add column if not exists roadmap_id uuid references roadmaps(id) on delete set null;
alter table tutor_threads add column if not exists language text default 'python';
alter table tutor_threads add column if not exists updated_at timestamptz default now();

-- backfill title from first message
update tutor_threads set title = left((messages->0->>'content')::text, 40) where title is null and jsonb_array_length(messages) > 0;

create index if not exists tutor_threads_user_updated_idx on tutor_threads(user_id, updated_at desc);
create index if not exists tutor_threads_user_roadmap_idx on tutor_threads(user_id, roadmap_id, node_order);

create or replace function set_tutor_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
drop trigger if exists tutor_threads_updated_at on tutor_threads;
create trigger tutor_threads_updated_at before update on tutor_threads for each row execute function set_tutor_updated_at();
