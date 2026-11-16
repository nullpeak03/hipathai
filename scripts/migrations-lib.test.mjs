import { describe, expect, it } from "vitest"
import {
  checksumOf,
  compareVersions,
  diffMigrations,
  formatReport,
  isClean,
  listLocalMigrations,
  parseMigrationName,
  parseVersion,
} from "./migrations-lib.mjs"

const file = (name, sql = name) => ({ name, checksum: checksumOf(sql) })

describe("migration naming", () => {
  it("accepts the numbered and lettered forms", () => {
    expect(parseMigrationName("001_hipath.sql")?.version).toBe("001")
    expect(parseMigrationName("010a_rate_limits.sql")?.version).toBe("010a")
    expect(parseMigrationName("030_migration_ledger.sql")?.version).toBe("030")
  })

  it("ignores non-migration files", () => {
    expect(parseMigrationName("README.md")).toBeNull()
    expect(parseMigrationName("010a_rate_limits.sql.bak")).toBeNull()
    expect(parseMigrationName("1_short.sql")).toBeNull()
  })

  it("orders a lettered pair between the plain neighbours", () => {
    expect(compareVersions("010a", "010b")).toBeLessThan(0)
    expect(compareVersions("010b", "011")).toBeLessThan(0)
    expect(compareVersions("009", "010a")).toBeLessThan(0)
    expect(parseVersion("010b")).toEqual([10, 2])
  })
})

describe("listLocalMigrations", () => {
  it("sorts by version, not by filename", () => {
    const { migrations, duplicates } = listLocalMigrations([
      file("011_public.sql"),
      file("010b_tutor_images.sql"),
      file("010a_rate_limits.sql"),
      file("009_x.sql"),
    ])
    expect(migrations.map((m) => m.version)).toEqual(["009", "010a", "010b", "011"])
    expect(duplicates).toEqual([])
  })

  it("reports a duplicate prefix instead of silently ordering it", () => {
    const { duplicates } = listLocalMigrations([
      file("010_rate_limits.sql"),
      file("010_tutor_images.sql"),
    ])
    expect(duplicates).toEqual(["010"])
  })

  it("ignores files that are not migrations", () => {
    const { migrations, ignored } = listLocalMigrations([file("001_x.sql"), file("notes.txt")])
    expect(migrations).toHaveLength(1)
    expect(ignored).toEqual(["notes.txt"])
  })
})

describe("diffMigrations", () => {
  const local = [file("001_a.sql"), file("002_b.sql")]

  it("is clean when every file is applied with the same checksum", () => {
    const parsed = listLocalMigrations(local).migrations
    const applied = parsed.map((m) => ({ version: m.version, name: m.name, checksum: m.checksum }))
    const report = diffMigrations(parsed, applied)
    expect(report).toEqual({ pending: [], missingFiles: [], checksumDrift: [] })
    expect(isClean(report)).toBe(true)
  })

  it("lists a new file as pending", () => {
    const report = diffMigrations(local, [{ version: "001", name: "001_a.sql", checksum: local[0].checksum }])
    expect(report.pending).toEqual(["002"])
    expect(isClean(report)).toBe(false)
  })

  it("flags an applied migration whose file disappeared", () => {
    const applied = [
      { version: "001", name: "001_a.sql", checksum: local[0].checksum },
      { version: "002", name: "002_b.sql", checksum: local[1].checksum },
      { version: "003", name: "003_c.sql", checksum: checksumOf("003") },
    ]
    expect(diffMigrations(local, applied).missingFiles).toEqual(["003"])
  })

  it("flags an applied file that was edited afterwards", () => {
    const applied = [
      { version: "001", name: "001_a.sql", checksum: checksumOf("changed") },
      { version: "002", name: "002_b.sql", checksum: local[1].checksum },
    ]
    expect(diffMigrations(local, applied).checksumDrift).toEqual(["001"])
  })

  it("treats a null checksum as unknown, not drift", () => {
    const applied = [
      { version: "001", name: "001_a.sql", checksum: null },
      { version: "002", name: "002_b.sql", checksum: local[1].checksum },
    ]
    expect(diffMigrations(local, applied).checksumDrift).toEqual([])
  })
})

describe("formatReport", () => {
  it("names every problem and says ok only when clean", () => {
    const dirty = diffMigrations(
      [file("001_a.sql"), file("002_b.sql")],
      [{ version: "001", name: "001_a.sql", checksum: checksumOf("edited") }]
    )
    const text = formatReport(dirty, [], 2)
    expect(text).toContain("pending: 002")
    expect(text).toContain("edited after applying: 001")
    expect(text).not.toContain("ok:")

    const clean = diffMigrations([file("001_a.sql")], [
      { version: "001", name: "001_a.sql", checksum: file("001_a.sql").checksum },
    ])
    expect(formatReport(clean, [], 1)).toContain("ok: database is current")
  })
})
