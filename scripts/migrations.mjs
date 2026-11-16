#!/usr/bin/env node
// Migration ledger CLI — the answer to "is production current?".
//
//   node scripts/migrations.mjs files    # repo-only checks (safe in CI, no secrets)
//   node scripts/migrations.mjs status   # repo vs database; exit 1 when behind
//   node scripts/migrations.mjs record   # backfill/refresh checksums (writes)
//
// `status` and `record` connect through DIRECT_URL (the session-mode Postgres
// connection string), not the REST API: it is the value operators already have,
// and it is not subject to RLS or to Vercel masking the service-role key.
//
// npm run migrations:status / migrations:record load .env and .env.local.

import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { Client } from "pg"
import {
  checksumOf,
  diffMigrations,
  formatReport,
  isClean,
  listLocalMigrations,
} from "./migrations-lib.mjs"

const MIGRATIONS_DIR = "supabase/migrations"
const LEDGER = "public.schema_migrations"

function readLocalMigrations() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => ({
      name,
      checksum: checksumOf(readFileSync(join(MIGRATIONS_DIR, name), "utf8")),
    }))
  return listLocalMigrations(files)
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value || value === "[SENSITIVE]") {
    console.error(
      `missing usable ${name}. Set it in the shell or pass --env-file (see docs/MIGRATIONS.md).\n` +
        `Note: \`vercel env pull\` masks some secrets; copy DIRECT_URL from the Supabase dashboard instead.`
    )
    process.exit(2)
  }
  return value
}

async function withClient(fn) {
  const client = new Client({
    connectionString: requireEnv("DIRECT_URL"),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
  })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

async function readApplied(client) {
  try {
    const { rows } = await client.query(`select version, name, checksum from ${LEDGER}`)
    return rows
  } catch (error) {
    if (error && error.code === "42P01") {
      console.error(
        `ledger table ${LEDGER} is missing.\n` +
          `Apply supabase/migrations/030_migration_ledger.sql first, then re-run.`
      )
      process.exit(2)
    }
    throw error
  }
}

function report(local, applied) {
  const diff = diffMigrations(local.migrations, applied)
  console.log(formatReport(diff, local.duplicates, local.migrations.length))
  if (local.ignored.length > 0) console.log(`ignored: ${local.ignored.join(", ")}`)
  return diff
}

async function main() {
  const command = process.argv[2] ?? "status"

  if (command === "files") {
    const local = readLocalMigrations()
    if (local.duplicates.length > 0) {
      console.error(`duplicate migration versions: ${local.duplicates.join(", ")}`)
      process.exit(1)
    }
    console.log(`migrations: ${local.migrations.length} files, ordered ${local.migrations[0]?.version} → ${local.migrations.at(-1)?.version}`)
    console.log("ok: filenames are unique and orderable")
    return
  }

  if (command === "status") {
    const local = readLocalMigrations()
    await withClient(async (client) => {
      const diff = report(local, await readApplied(client))
      if (!isClean(diff, local.duplicates)) process.exitCode = 1
    })
    return
  }

  if (command === "record") {
    const force = process.argv.includes("--force")
    const local = readLocalMigrations()
    await withClient(async (client) => {
      const applied = await readApplied(client)
      const diff = diffMigrations(local.migrations, applied)
      const problems = [
        ...local.duplicates.map((v) => `duplicate version: ${v}`),
        ...diff.pending.map((v) => `pending: ${v}`),
        ...diff.missingFiles.map((v) => `applied but missing from repo: ${v}`),
        ...diff.checksumDrift.map((v) => `edited after applying: ${v}`),
      ]
      if (problems.length > 0) console.log(problems.join("\n"))

      const edited = force ? [] : diff.checksumDrift
      if (edited.length > 0) {
        console.error(
          `refusing to overwrite edited migrations: ${edited.join(", ")}\n` +
            `Applied files must never change. Add a new migration, or pass --force if the ledger is wrong.`
        )
        process.exitCode = 1
        return
      }

      const rows = local.migrations.filter((m) => {
        const existing = applied.find((a) => a.version === m.version)
        // New rows, and rows backfilled by the SQL migration without a checksum.
        return !existing || !existing.checksum || force
      })
      if (rows.length === 0) {
        console.log("ledger already matches the repository")
        return
      }
      await client.query(
        `insert into ${LEDGER} (version, name, checksum)
         select * from unnest($1::text[], $2::text[], $3::text[])
         on conflict (version) do update
           set name = excluded.name, checksum = excluded.checksum`,
        [rows.map((r) => r.version), rows.map((r) => r.name), rows.map((r) => r.checksum)]
      )
      console.log(`recorded ${rows.length} migration(s): ${rows.map((r) => r.version).join(", ")}`)
    })
    return
  }

  console.error(`unknown command: ${command}\nusage: migrations.mjs [files|status|record]`)
  process.exit(2)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(2)
})
