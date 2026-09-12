# Supabase Production Guide — Wipeout Recovery

You wiped the DB. This guide gets you back to production in 5 minutes.

## 1. Fresh DB — Run ONE file

**Supabase Dashboard → SQL Editor → New query → paste `supabase/schema.sql` → Run**

This file is now **production-ready and idempotent** (`create table if not exists`, `create extension if not exists`, `drop policy if exists`).

It creates:

- `pgcrypto` + `pg_trgm` extensions (for `gen_random_uuid()` and title search)
- `users` (with `settings jsonb`, `display_name`, `updated_at`, checks for `hrs_per_day`, `deadline` future)
- `roadmaps` (with `updated_at`, `idempotency_key`, `user_id` FK, status check, version, goal/title, draft/nodes, indexes `user_idx`, `user_status_idx`, `idempotency`)
- `progress_events` (with `type` check, `score` 0-100, indexes `user_ts`, `user_type`, `user_node_type`)
- `tutor_threads` (with `title`, `roadmap_id`, `language`, `updated_at`, indexes `user_updated`, `user_roadmap`, trigram on title)
- `ai_logs` (with `task` check, `latency_ms` >=0, `fallback_used`, `error_code`, `tokens`, index `user_ts`)
- `rate_limits` (for Supabase-backed rate limiting, replaces in-memory Maps)
- Triggers `set_updated_at()` for `users`, `roadmaps`, `tutor_threads`
- RLS **enabled** on all tables + **policies** `clerk_owns_*` (`auth.jwt()->>'sub' = user_id/clerk_id`) — requires Clerk JWT template "supabase" (see step 2)

**If you previously ran only the old `schema.sql` (68 lines), it lacked `updated_at`, `idempotency_key`, `tutor_threads` new columns, and policies. The new file fixes that.**

## 2. Clerk JWT Template (one-time, 2 min)

**Clerk Dashboard → JWT Templates → New Template → Supabase**

- Name: `supabase`
- Claims: `sub: {{user.id}}` (default is correct)
- Save

Supabase will now have `auth.jwt()->>'sub'` = Clerk `userId`. Our `serviceClient` (service_role) bypasses RLS, so server routes still work, but browser `supabaseBrowser` (anon) will now only see own rows via policies.

## 3. Verify

```sql
-- In Supabase SQL editor, run:
select tablename, rowsecurity from pg_tables where schemaname='public';
select * from pg_policies where schemaname='public';
select indexname from pg_indexes where tablename in ('roadmaps','tutor_threads','rate_limits');
```

Expect: `rowsecurity = true` for all, 5+ policies, 10+ indexes.

## 4. Migrations are now merged

You had `002_indexes_and_rls_fix.sql`, `003_tutor_modern.sql`, `004_onboarding_flex.sql` — all are now **merged into `schema.sql`**. `005_production_hardening.sql` is redundant but safe to keep (it is idempotent via `if not exists`/`drop if exists`).

If you want to keep history:
- `supabase/migrations/002` → indexes, heal
- `003` → tutor threads upgrade
- `004` → onboarding flex
- `005` → production hardening (rate_limits, RLS, anon 401 docs)

All are safe to re-run.

## 5. Code Changes Already Pushed

- `lib/caller.ts` + `lib/rateLimit.ts` → `isAnon` check + `checkAiDayAsync`/`checkRoadmapWeekAsync`/`checkTutorDayAsync` (Supabase `rate_limits` table, fallback to in-memory)
- `app/api/*` routes now `if (userKey.startsWith("anon:")) return 401` for mutating POSTs (roadmaps/generate, lessons, quiz, tutor, projects, run)
- `app/api/webhooks/clerk/route.ts` → `svix` verification for `CLERK_WEBHOOK_SECRET` (`user.created/deleted/updated`)

## 6. Local vs Production

- **Local dev (`npm run dev`)** without Clerk keys: `proxy.ts` `NextResponse.next()` allows `/app/*` as `anon:local` — will now get `401` on POSTs, which is correct. Use `CLERK_SECRET_KEY` locally or set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to test auth.
- **Vercel:** Ensure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NIM_API_KEY`, `GOOGLE_API_KEY`, `GITHUB_TOKEN` are set.

## 7. Next Task

Run `schema.sql` once, then test:

```bash
curl https://www.hipathai.me/api/me/active # should be 401 if not signed in, not anon data
```

Dashboard will now correctly show `Continue to Dashboard` only for signed-in users with ready roadmaps, and `401` for anon writes.
