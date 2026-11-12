#!/usr/bin/env node
/**
 * Checks which NVIDIA NIM models this key/account can actually run.
 *
 *   npm run check:ai
 *   AI_PROBE_MODELS="model/a,model/b" npm run check:ai
 *
 * A key can be present yet truncated/revoked, and an account can lack access
 * to a specific model — NVCF reports that as:
 *   404 {"detail":"Function '<uuid>': Not found for account '<id>'"}
 * That is what silently killed roadmap generation: the fallback model was
 * unavailable, so a slow primary had nowhere to go.
 */
const key = (process.env.NVIDIA_NIM_API_KEY || "").trim()
const base = process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1/chat/completions"
const PROBE_TIMEOUT_MS = Number(process.env.AI_PROBE_TIMEOUT_MS || 45_000)

const configured = [
  ["roadmap", process.env.NIM_ROADMAP_MODEL || "nvidia/nemotron-3-ultra-550b-a55b"],
  ["roadmap-fallback", process.env.NIM_ROADMAP_FALLBACK_MODEL || "nvidia/nemotron-3-super-120b-a12b"],
  ["lesson", process.env.NIM_LESSON_MODEL || "nvidia/nemotron-3-super-120b-a12b"],
  ["quiz", process.env.NIM_QUIZ_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b"],
  ["tutor", process.env.NIM_TUTOR_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b"],
  ["weakness", process.env.NIM_WEAKNESS_MODEL || "meta/muse-glimmer-30b"],
]
const candidates = [
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  "nvidia/llama-3.1-nemotron-70b-instruct",
  "nvidia/llama-3.1-nemotron-ultra-253b-v1",
  "nvidia/nemotron-3.5-bolt-e4b",
]
const extra = (process.env.AI_PROBE_MODELS || "")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean)

const formatProblems = []
if (!key) formatProblems.push("NVIDIA_NIM_API_KEY is not set")
else {
  if (!key.startsWith("nvapi-")) formatProblems.push("key does not start with nvapi-")
  if (key.length < 50) formatProblems.push(`key is only ${key.length} characters (a full key is about 70)`)
}
if (formatProblems.length > 0) {
  console.error("✗ NVIDIA_NIM_API_KEY looks invalid: " + formatProblems.join("; "))
  process.exit(1)
}

const targets = new Map()
for (const [role, model] of configured) targets.set(model, role)
for (const model of candidates) if (!targets.has(model)) targets.set(model, "candidate")
for (const model of extra) targets.set(model, "candidate")

let configuredFailures = 0
let successes = 0
console.log(`Probing ${targets.size} models with a ${PROBE_TIMEOUT_MS}ms cap each\n`)

for (const [model, role] of targets) {
  const started = Date.now()
  let res
  try {
    res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: 'Reply with exactly: {"ok":true}' }],
        max_tokens: 120,
        temperature: 0,
        // Mirror the router: reasoning Nemotron variants must have thinking
        // disabled or they stream chain-of-thought until the timeout.
        chat_template_kwargs: { enable_thinking: false },
      }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
  } catch (error) {
    console.log(`✗ ${role.padEnd(16)} ${model}: request failed after ${Date.now() - started}ms (${error instanceof Error ? error.message : error})`)
    if (role !== "candidate") configuredFailures++
    continue
  }

  const elapsed = Date.now() - started
  const body = await res.text()
  if (!res.ok) {
    let detail = body
    try {
      detail = JSON.parse(body)?.detail ?? body
    } catch {}
    console.log(`✗ ${role.padEnd(16)} ${model}: HTTP ${res.status} in ${elapsed}ms — ${String(detail).slice(0, 160)}`)
    if (role !== "candidate") configuredFailures++
    continue
  }

  let content = ""
  try {
    content = JSON.parse(body)?.choices?.[0]?.message?.content ?? ""
  } catch {
    content = body
  }
  if (!content.trim()) {
    console.log(`✗ ${role.padEnd(16)} ${model}: HTTP ${res.status} but empty reply in ${elapsed}ms`)
    if (role !== "candidate") configuredFailures++
    continue
  }
  const budget = Number(process.env.AI_PROBE_BUDGET_MS || 45_000)
  const verdict = elapsed > budget ? `⚠ slow (> ${budget}ms budget)` : "✓"
  console.log(`${verdict} ${role.padEnd(16)} ${model}: HTTP ${res.status} in ${elapsed}ms`)
  successes++
}

console.log(`\n${successes}/${targets.size} models usable.`)
if (configuredFailures > 0) {
  console.error(`${configuredFailures} configured model(s) failed — update NIM_*_MODEL env vars to a ✓ model above.`)
  process.exit(1)
}
