-- Migration 015: canonical topic keys for public roadmaps (one roadmap per topic)
alter table public_roadmaps add column if not exists topic_key text;

create index if not exists public_roadmaps_topic_key_idx
  on public_roadmaps (topic_key);

-- Enforce one non-null topic key per topic while allowing legacy null rows.
create unique index if not exists public_roadmaps_topic_key_unique
  on public_roadmaps (topic_key)
  where topic_key is not null;
