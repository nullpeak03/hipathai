// Seed the public roadmap library by cloning the best production rows.
// Run AFTER migration 011 is applied: node scripts/seed-library.mjs
// Reads Supabase creds from .env / .env.local (service role). Zero AI cost:
// copies proven titles + objectives already stored in lessons.content_md.
import { readFileSync } from "node:fs"

const env = {}
for (const f of [".env", ".env.local"]) {
  try {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const t = line.trim()
      if (t && !t.startsWith("#") && t.includes("=")) {
        const [k, ...v] = t.split("=")
        env[k.trim()] ??= v.join("=").trim().replace(/^["']|["']$/g, "")
      }
    }
  } catch { /* missing file — skip */ }
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

// [sourceRoadmapId, slug, seoTitle, seoDescription]
const PICKS = [
  ["588a0900", "python-django-developer", "Python Django Developer Roadmap",
    "Master Python and Django from scratch with this week-by-week roadmap: backend foundations, ORM, REST APIs, auth, and deployment."],
  ["a8c3ced3", "trading-fundamentals-strategy", "Trading Fundamentals to Live Strategy",
    "Go from trading basics to a live strategy with this structured week-by-week roadmap: markets, analysis, risk, and execution."],
  ["621ad548", "dsa-career-switch", "Data Structures & Algorithms for Career Switch",
    "Crack coding interviews with this week-by-week DSA roadmap: complexity, arrays, trees, graphs, and dynamic programming."],
  ["b008d131", "full-stack-web-development", "Full Stack Web Development Roadmap",
    "Become a full-stack developer with this week-by-week roadmap: frontend, backend, databases, and deployment."],
  ["ae6d7bbe", "ai-agent-developer", "AI Agent Developer Roadmap",
    "Build autonomous AI agents with this week-by-week roadmap: Python, LLMs, tools, memory, and multi-agent systems."],
  ["4f70da4e", "cloud-devops-career", "Cloud & DevOps Career Roadmap",
    "Switch into cloud and DevOps with this week-by-week roadmap: Linux, CI/CD, containers, and cloud platforms."],
  ["fdddd8c1", "machine-learning-fundamentals", "Machine Learning Fundamentals Roadmap",
    "Learn machine learning from scratch with this week-by-week roadmap: Python data stack, models, evaluation, and projects."],
]

async function api(path, opts = {}) {
  const r = await fetch(`${URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opts.headers || {}),
    },
  })
  if (!r.ok) throw new Error(`${opts.method || "GET"} ${path} -> ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

function objectiveOf(contentMd) {
  const lines = String(contentMd || "").split("\n").map((l) => l.trim()).filter(Boolean)
  const first = lines.find((l) => !l.startsWith("#")) || ""
  return first.slice(0, 220)
}

const allRoadmaps = await api("/roadmaps?select=id,title,description,goal,level&limit=200");
for (const [sourcePrefix, slug, title, description] of PICKS) {
  const rm = allRoadmaps.filter((r) => r.id.startsWith(sourcePrefix));
  const sourceId = rm[0]?.id;
  if (!sourceId) { console.log(`SKIP ${slug}: source missing`); continue }
  const phases = await api(`/phases?select=id,idx,title&roadmap_id=eq.${sourceId}&order=idx`);
  const syllabus = { phases: [] }
  for (const p of phases) {
    const lessons = await api(`/lessons?select=title,content_md&roadmap_id=eq.${sourceId}&phase_id=eq.${p.id}&order=idx&limit=100`);
    const clean = lessons
      .filter((l) => l.title && !/part\s+\d+/i.test(l.title))
      .map((l) => ({ title: l.title.trim().slice(0, 120), objective: objectiveOf(l.content_md) }))
    if (clean.length > 0) syllabus.phases.push({ title: p.title, lessons: clean })
  }
  if (syllabus.phases.length === 0) { console.log(`SKIP ${slug}: no usable phases`); continue }
  const total = syllabus.phases.reduce((a, p) => a + p.lessons.length, 0)
  const row = {
    slug,
    title,
    description: `${description} (${syllabus.phases.length} phases, ${total} lessons, free).`,
    goal: rm[0].goal || title,
    level: rm[0].level || "Beginner",
    syllabus,
    source_roadmap_id: sourceId,
  }
  const existing = await api(`/public_roadmaps?select=id&slug=eq.${slug}`);
  if (existing[0]) {
    await api(`/public_roadmaps?id=eq.${existing[0].id}`, { method: "PATCH", body: JSON.stringify(row) })
    console.log(`UPDATED ${slug}: ${syllabus.phases.length} phases, ${total} lessons`)
  } else {
    await api("/public_roadmaps", { method: "POST", body: JSON.stringify(row) })
    console.log(`INSERTED ${slug}: ${syllabus.phases.length} phases, ${total} lessons`)
  }
}
console.log("done")
