// Pure helpers for the migration ledger (`scripts/migrations.mjs`).
//
// The database is the source of truth for what has been applied; this file
// only compares two lists. Keeping it free of I/O lets the ordering, duplicate
// and drift rules be unit-tested without a database (same convention as
// `src/lib/*`).
//
// Version format: three digits plus an optional letter, so the historical
// duplicate `010_rate_limits` / `010_tutor_images` pair could be repaired
// without renumbering everything after it.

import { createHash } from "node:crypto"

export const MIGRATION_PATTERN = /^(\d{3})([a-z]?)_([a-z0-9_]+)\.sql$/i

/** sha256 of the file bytes, hex. Stored in the ledger to detect edits. */
export function checksumOf(sql) {
  return createHash("sha256").update(sql, "utf8").digest("hex")
}

/**
 * `010a_rate_limits.sql` → { version: "010a", ordinal: [10, 0], name }.
 * Returns null for files that are not migrations.
 */
export function parseMigrationName(fileName) {
  const match = MIGRATION_PATTERN.exec(fileName)
  if (!match) return null
  const [, digits, suffix, label] = match
  return {
    fileName,
    version: `${digits}${suffix}`,
    name: fileName,
    ordinal: [Number.parseInt(digits, 10), suffix ? suffix.charCodeAt(0) - 96 : 0],
    label,
  }
}

/** `"010a"` → numeric ordering keys; null for anything else. */
export function parseVersion(version) {
  const match = /^(\d{3})([a-z]?)$/.exec(version)
  if (!match) return null
  return [Number.parseInt(match[1], 10), match[2] ? match[2].charCodeAt(0) - 96 : 0]
}

/** Compare two versions the way they should be applied: 010a < 010b < 011. */
export function compareVersions(a, b) {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa || !pb) return a.localeCompare(b)
  return pa[0] - pb[0] || pa[1] - pb[1]
}

/**
 * Validate and sort a directory listing.
 * `files` is `[{ name, checksum }]`; non-migration files are ignored.
 */
export function listLocalMigrations(files) {
  const parsed = []
  const ignored = []
  for (const file of files) {
    const meta = parseMigrationName(file.name)
    if (!meta) {
      ignored.push(file.name)
      continue
    }
    parsed.push({ ...meta, checksum: file.checksum })
  }
  parsed.sort((a, b) => compareVersions(a.version, b.version))

  const duplicates = []
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i].version === parsed[i - 1].version) {
      duplicates.push(parsed[i].version)
    }
  }
  return { migrations: parsed, duplicates, ignored }
}

/**
 * Compare the repository against the applied rows.
 *
 * - `pending`: in the repo, not applied
 * - `missingFiles`: applied, but the file is gone from the repo (a restore or
 *   a deleted migration would break a rebuild)
 * - `checksumDrift`: applied with a different checksum (an applied file was
 *   edited — forbidden by `README.md` and `docs/MIGRATIONS.md`)
 */
export function diffMigrations(local, applied) {
  // Accept either parsed entries (from `listLocalMigrations`) or raw
  // `{ name, checksum }` file records; never emit `undefined` versions.
  const normalized = local
    .map((entry) => {
      if (entry.version) return entry
      const parsed = parseMigrationName(entry.name)
      return parsed ? { ...entry, ...parsed } : null
    })
    .filter(Boolean)

  const byVersion = new Map(normalized.map((m) => [m.version, m]))
  const appliedVersions = new Set(applied.map((row) => row.version))

  const pending = normalized
    .filter((m) => !appliedVersions.has(m.version))
    .map((m) => m.version)

  const missingFiles = applied
    .filter((row) => !byVersion.has(row.version))
    .map((row) => row.version)

  const checksumDrift = []
  for (const row of applied) {
    const file = byVersion.get(row.version)
    if (!file) continue
    if (typeof row.checksum === "string" && row.checksum.length > 0 && row.checksum !== file.checksum) {
      checksumDrift.push(row.version)
    }
  }

  return { pending, missingFiles, checksumDrift }
}

/** True when the database is current and no applied file was edited. */
export function isClean(report, duplicates = []) {
  return (
    duplicates.length === 0 &&
    report.pending.length === 0 &&
    report.missingFiles.length === 0 &&
    report.checksumDrift.length === 0
  )
}

/** Human-readable status block for CI logs and the terminal. */
export function formatReport(report, duplicates = [], total = 0) {
  const lines = []
  lines.push(`migrations: ${total} local, ${total - report.pending.length} applied`)
  if (duplicates.length > 0) lines.push(`duplicate versions: ${duplicates.join(", ")}`)
  if (report.pending.length > 0) lines.push(`pending: ${report.pending.join(", ")}`)
  if (report.missingFiles.length > 0) lines.push(`applied but missing from repo: ${report.missingFiles.join(", ")}`)
  if (report.checksumDrift.length > 0) lines.push(`edited after applying: ${report.checksumDrift.join(", ")}`)
  if (isClean(report, duplicates)) lines.push("ok: database is current and applied files are unchanged")
  return lines.join("\n")
}
