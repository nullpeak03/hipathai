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
const CS_KEYWORDS = new Set(["python","javascript","typescript","java","c","cpp","csharp","go","rust","php","sql","database","web","frontend","backend","fullstack","full","stack","data","structure","algorithm","machine","learning","ai","agent","agents","devops","cloud","system","design","cybersecurity","security","network","networking","operating","compiler","programming","code","coding","software","engineering","react","node","django","flask","api","rest","graphql","docker","kubernetes","linux","git","github","testing","debug","mobile","android","ios","swift","kotlin"])

function singularize(t){ return t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0,-1) : t }
function normalizeTopic(goal){
  const tokens = String(goal||"").toLowerCase().replace(/['’]/g,"").replace(/[^a-z0-9]+/g," ").split(" ").map(t=>t.trim()).filter(t=>t.length>0 && !FILLER.has(t)).map(singularize)
  return tokens.join("-")
}
function isCS(goal){
  const toks = String(goal||"").toLowerCase().replace(/[^a-z0-9]+/g," ").split(" ").filter(Boolean)
  return toks.some(t=>CS_KEYWORDS.has(t))
}
function topicSim(a,b){
  const na = normalizeTopic(a), nb = normalizeTopic(b)
  if (!na || !nb) return 0
  const sa=new Set(na.split("-")), sb=new Set(nb.split("-"))
  let inter=0; for (const t of sa) if (sb.has(t)) inter++
  const union = sa.size+sb.size-inter
  return union===0?0:inter/union
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

let removedNonCs = 0
const csRows = []
for (const row of rows) {
  if (!isCS(row.goal)) {
    await api(`/public_roadmaps?id=eq.${row.id}`, { method: "DELETE" })
    removedNonCs++
    console.log("Deleted non-CS", row.slug)
  } else csRows.push(row)
}
console.log("Removed non-CS:", removedNonCs)

let deleted = 0
const kept = []
const sorted = [...csRows].sort((a,b) => (b.clones_count||0)-(a.clones_count||0) || new Date(b.published_at)-new Date(a.published_at))
for (const row of sorted) {
  if (kept.some(k => topicSim(k.goal, row.goal) >= 0.5)) {
    await api(`/public_roadmaps?id=eq.${row.id}`, { method: "DELETE" })
    deleted++
    console.log("Deleted similar", row.slug)
  } else {
    kept.push(row)
  }
}
console.log("Deduplication complete. Deleted", deleted, "similar. Kept", kept.length)
