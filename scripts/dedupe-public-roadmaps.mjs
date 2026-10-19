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
  } catch {}
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const FILLER = new Set(["learn","learning","from","scratch","beginning","beginner","complete","full","course","tutorial","tutorials","guide","master","mastering","masterclass","crash","introduction","intro","basics","fundamentals","essentials","ultimate","a","an","the","to","for","with","in","on","of"])
function singularize(t){ return t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0,-1) : t }
function normalizeTopic(goal){
  const tokens = String(goal||"").toLowerCase().replace(/['’]/g,"").replace(/[^a-z0-9]+/g," ").split(" ").map(t=>t.trim()).filter(t=>t.length>0 && !FILLER.has(t)).map(singularize)
  return tokens.join("-")
}

async function api(path, opts={}) {
  const r = await fetch(`${URL}/rest/v1${path}`, {
    ...opts,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=representation", ...(opts.headers||{}) }
  })
  if (!r.ok) throw new Error(`${opts.method||"GET"} ${path} -> ${r.status}: ${(await r.text()).slice(0,200)}`)
  return r.json()
}

const rows = await api("/public_roadmaps?select=id,slug,goal,clones_count,published_at&limit=1000")
console.log("Loaded", rows.length, "public roadmaps")

// backfill topic_key
for (const row of rows) {
  const key = normalizeTopic(row.goal)
  row.topic_key = key
}

// group
const groups = new Map()
for (const row of rows) {
  if (!groups.has(row.topic_key)) groups.set(row.topic_key, [])
  groups.get(row.topic_key).push(row)
}

let deleted = 0
for (const [key, group] of groups) {
  if (group.length <= 1) continue
  // keep highest clones, then latest published
  group.sort((a,b) => (b.clones_count||0)-(a.clones_count||0) || new Date(b.published_at)-new Date(a.published_at))
  const keep = group[0]
  for (const row of group.slice(1)) {
    await api(`/public_roadmaps?id=eq.${row.id}`, { method: "DELETE" })
    deleted++
    console.log("Deleted duplicate", row.slug, "topic", key, "kept", keep.slug)
  }
}
console.log("Deduplication complete. Deleted", deleted)
