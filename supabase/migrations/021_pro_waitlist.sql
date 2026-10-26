create table if not exists public.pro_waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(btrim(email)) and length(email) <= 254),
  confirmation_token_hash text unique,
  confirmation_expires_at timestamptz,
  unsubscribe_token_hash text not null unique,
  confirmed_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists pro_waitlist_signups_email_lower_idx
  on public.pro_waitlist_signups (lower(email));

create index if not exists pro_waitlist_signups_confirmed_notified_idx
  on public.pro_waitlist_signups (confirmed_at, notified_at)
  where confirmed_at is not null and notified_at is null;

alter table public.pro_waitlist_signups enable row level security;

revoke all on public.pro_waitlist_signups from public, anon, authenticated;
grant select, insert, update, delete on public.pro_waitlist_signups to service_role;
