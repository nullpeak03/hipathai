-- HiPath AI migration 011 — public roadmap library (SEO : Strategy A).
-- Canonical, hand-reviewed syllabi surfaced as indexable pages at
-- /roadmaps/[slug], with one-click cloning into signed-in accounts.
-- Apply via Supabase Dashboard SQL Editor.

create table if not exists public_roadmaps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  description text not null,
  goal text not null,
  level text not null default 'Beginner',
  syllabus jsonb not null default '{"phases":[]}',
  source_roadmap_id uuid,
  clones_count integer not null default 0,
  published_at timestamptz not null default now()
);

create index if not exists public_roadmaps_published_idx
  on public_roadmaps (published_at desc);

alter table public_roadmaps enable row level security;

-- Public read-only: anyone (incl. anon crawlers) may read published rows.
-- Writes stay service-role-only (server routes + seed scripts).
create policy "public read published roadmaps"
  on public_roadmaps for select
  to anon, authenticated
  using (true);
