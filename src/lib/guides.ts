import { readdirSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"

// Guides engine: markdown files in content/guides/*.md with frontmatter.
// Server-only (fs access) — import from server components/routes only.

export type GuideMeta = {
  slug: string
  title: string
  description: string
  date: string
  topics: string[]
  relatedSlugs: string[]
  minutes: number
}

export type Guide = GuideMeta & {
  content: string
  headings: { level: 2 | 3; text: string; id: string }[]
}

const DIR = join(process.cwd(), "content", "guides")

function slugifyFile(name: string): string {
  return name.replace(/\.md$/, "")
}

export function readingMinutes(markdown: string): number {
  const words = markdown.replace(/[#*`>\-\[\]()]/g, " ").split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

export function extractHeadings(markdown: string): Guide["headings"] {
  const out: Guide["headings"] = []
  for (const line of markdown.split("\n")) {
    const m = line.match(/^(#{2,3})\s+(.+)$/)
    if (!m) continue
    const text = m[2]!.trim()
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    out.push({ level: m[1]!.length === 2 ? 2 : 3, text, id })
  }
  return out
}

function parseFile(name: string): Guide | null {
  try {
    const raw = readFileSync(join(DIR, name), "utf8")
    const { data, content } = matter(raw)
    const slug = slugifyFile(name)
    const title = typeof data.title === "string" ? data.title.trim() : ""
    const description = typeof data.description === "string" ? data.description.trim() : ""
    if (!title || !description) return null
    const topics = Array.isArray(data.topics) ? data.topics.filter((t): t is string => typeof t === "string") : []
    const relatedSlugs = Array.isArray(data.relatedSlugs)
      ? (data.relatedSlugs as unknown[]).filter((s): s is string => typeof s === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s))
      : []
    const date = typeof data.date === "string" ? data.date : "2026-01-01"
    return {
      slug, title, description: description.slice(0, 300), date, topics, relatedSlugs,
      content: content.trim(), minutes: readingMinutes(content), headings: extractHeadings(content),
    }
  } catch {
    return null
  }
}

export function listGuides(): GuideMeta[] {
  if (!existsSync(DIR)) return []
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".md"))
    .map(parseFile)
    .filter((g): g is Guide => g !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map(({ content, headings, ...meta }) => {
      void content
      void headings
      return meta
    })
}

export function loadGuide(slug: string): Guide | null {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null
  if (!existsSync(DIR)) return null
  const match = readdirSync(DIR).find((f) => slugifyFile(f) === slug)
  if (!match) return null
  return parseFile(match)
}

/** Guides linking a library topic (for backlinks on /roadmaps/[slug]). */
export function guidesForRoadmap(slug: string): GuideMeta[] {
  return listGuides().filter((g) => g.relatedSlugs.includes(slug))
}
