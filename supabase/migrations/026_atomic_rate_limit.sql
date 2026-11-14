-- Migration 026 — atomic sliding-window rate limiting.
--
-- The application checked limits with SELECT-then-INSERT: concurrent
-- requests all read the same count and all passed, so a burst could exceed
-- a 5/hour roadmap limit. This function does the prune, count, and insert in
-- one transaction, serialized per key with an advisory lock.
--
-- Apply via Supabase Dashboard SQL Editor or `supabase db push`.

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_ms bigint,
  p_now timestamptz
)
returns table (allowed boolean, retry_after_ms bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window interval;
  v_cutoff timestamptz;
  v_count integer;
  v_oldest timestamptz;
begin
  if p_limit < 1 then
    return query select false, 0::bigint;
    return;
  end if;

  v_window := make_interval(secs => p_window_ms::double precision / 1000.0);
  v_cutoff := p_now - v_window;

  -- Serialize checks for the same key. A hashtext collision only serializes
  -- unrelated keys; it never lets a request through twice.
  perform pg_advisory_xact_lock(hashtext(p_key));

  delete from rate_limit_hits where key = p_key and ts <= v_cutoff;

  select count(*), min(ts)
    into v_count, v_oldest
    from rate_limit_hits
   where key = p_key;

  if v_count >= p_limit then
    return query
      select false,
             greatest(
               0,
               ceil(extract(epoch from (v_oldest + v_window - p_now)) * 1000)
             )::bigint;
    return;
  end if;

  insert into rate_limit_hits (key, ts) values (p_key, p_now);

  return query select true, 0::bigint;
end;
$$;

-- Service-role only: the browser must not be able to consume or reset its
-- own limits through PostgREST.
revoke all on function public.consume_rate_limit(text, integer, bigint, timestamptz) from public;
revoke all on function public.consume_rate_limit(text, integer, bigint, timestamptz) from anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, bigint, timestamptz) to service_role;
