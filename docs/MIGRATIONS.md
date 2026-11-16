# Migrations and backups

P2-5 of the 2026-11-13 audit. Two problems motivated this document:

1. Migrations 026–029 were applied over the direct Postgres connection. They
   worked, but the Supabase SQL editor history only records statements typed
   into the editor, so the project *looked* stuck at 025 — there was no way to
   ask the database "am I current?".
2. `supabase/migrations/` contained two `010_` files, no CLI config, no CI
   check, and no rehearsed restore.

## Source of truth

`public.schema_migrations` (migration `030`) is the record of what production
has. One row per file: `version`, `name`, `checksum`, `applied_at`,
`applied_by`. It is RLS-denied to `anon`/`authenticated`; the tool connects as
the database owner through `DIRECT_URL`, and the SQL editor can read it too.

`supabase/migrations/*.sql` is the record of what the code expects. The two are
compared by `scripts/migrations.mjs`.

```bash
npm run migrations:files    # repo only: naming + duplicates. Safe in CI, no secrets.
npm run migrations:status   # repo vs database. Exit 1 when behind/edited. Needs DIRECT_URL.
npm run migrations:record   # fill checksums and backfill rows (write access).
```

`status` and `record` need the session-mode connection string:

```bash
DIRECT_URL='postgresql://...' npm run migrations:status
```

`vercel env pull` masks some secrets (`[SENSITIVE]`), so copy `DIRECT_URL`
from the Supabase dashboard (Project Settings → Database → Connection string →
Session mode) rather than from a pulled file. The script refuses a masked value
instead of failing halfway.

Exit codes: `0` current, `1` behind / drifted / duplicate versions, `2` bad
config or missing ledger.

## Naming and order

```
NNN[_letter]_short_name.sql     001_hipath.sql
                                010a_rate_limits.sql
                                010b_tutor_images.sql
                                030_migration_ledger.sql
```

- Three digits, optional letter, underscore, snake_case name.
- Order is numeric, then letter: `010a` < `010b` < `011`. Do not rely on
  filename sorting in the shell for the lettered pair.
- The historical duplicate was repaired by renaming to `010a`/`010b`. Nothing
  after it was renumbered, so the numbers in old notes still line up.
- Versions are permanent. A number is never reused, even if the migration was
  reverted.

## Applying a migration

Vercel deploys code; **it never runs SQL**. Apply the migration first, then
deploy if the code depends on it.

Option A — dashboard (what operators use today):

1. Open SQL Editor, paste the file, run it.
2. It self-records when the file ends with its ledger insert (030 does; from
   031 onward, end every migration with one).
3. From a terminal with production env: `npm run migrations:record` to store
   checksums.

Option B — CLI (needs `supabase login` + `supabase link --project-ref <ref>`):

```bash
supabase db push          # applies pending files, writes supabase_migrations.*
npm run migrations:record # mirrors them into public.schema_migrations
```

Both paths must end with `npm run migrations:status` printing
`ok: database is current`.

### Applied means frozen

Never edit an applied migration. `status` fails with
`edited after applying: <version>` because the checksum no longer matches.
Change the schema with a new file. If the ledger is wrong (for example the
checksum was recorded from a different branch), re-record that version:

```bash
node scripts/migrations.mjs record --force
```

## Adding a migration — checklist

1. `npm run migrations:status` — start from a clean ledger.
2. Create `supabase/migrations/NNN_name.sql` with the next number.
3. Write idempotent SQL (`create table if not exists`, `add column if not
   exists`, `drop policy if exists`) so a re-run or a shadow replay is safe.
4. Enable RLS and deny `anon`/`authenticated` unless a client policy is
   intentional.
5. End the file with its own ledger row:

   ```sql
   insert into public.schema_migrations (version, name)
   values ('031', '031_example.sql')
   on conflict (version) do nothing;
   ```

6. Apply it, then `npm run migrations:record`, then `npm run migrations:status`.
7. Deploy the code that depends on it.

## CI

`.github/workflows/ci.yml` runs `npm run migrations:files`, which needs no
secrets and catches duplicate or unorderable filenames. The database comparison
belongs in the deploy job (or a scheduled job) where production credentials
exist; run `npm run migrations:status` there and fail the deploy when the
database is behind.

## Backups and restore drill

Two layers, because they fail differently:

| Layer | What it covers | Cadence | Owner action |
| --- | --- | --- | --- |
| Supabase PITR | Whole database, to the second | Continuous (Pro plan) | Confirm it is enabled in Project Settings → Database → Backups |
| Logical dump | Schema + data you can read and grep | Weekly, before risky migrations | `pg_dump "$DIRECT_URL" --no-owner --format=custom -f backups/hipath-$(date +%F).dump` |
| Storage | Tutor images and avatars (not in PITR) | Monthly, or before a storage policy change | Supabase Dashboard → Storage → download the buckets you rely on |

Keep dumps outside the repository (`backups/` is ignored). `DIRECT_URL` is the
session-mode connection string; use it, not the pooled one, for `pg_dump`.

### Restore drill (rehearse quarterly)

A backup nobody restored is a hypothesis.

1. Create a scratch Supabase project (never restore over production).
2. `pg_restore --no-owner --dbname "$SCRATCH_DIRECT_URL" backups/<latest>.dump`.
3. Run `select version from public.schema_migrations order by version;` and
   compare with `npm run migrations:files` — the list must match.
4. Run `supabase/dogfood/learning-loop-check.sql` against the scratch project:
   if it prints `dogfood OK`, the schema and the grading function survived.
5. Restore one storage bucket, open a tutor image by signed URL.
6. Record the date and the duration in the ops log. Anything that needs a
   manual step becomes a line in this document.

Target: a scratch restore in under 30 minutes, with the ledger matching.

## Rollback policy

Forward-only. Every migration is additive or policy-tightening; a mistake is
corrected by the next migration. Destructive changes (dropping a column or
table) need a two-step release: stop reading it, deploy, drop it in a later
migration — never in the same deploy that stops using it.
