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
const primaryKey = (process.env.NVIDIA_NIM_API_KEY || "").trim()
const secondaryKey = (process.env.NVIDIA_NIM_API_KEY_2 || "").trim()
// Failover is automatic in the app; this script probes one key at a time so a
// bad second key is visible before it is needed.
const probeSlot = process.env.AI_PROBE_KEY === "2" ? 2 : 1
const key = probeSlot === 2 ? secondaryKey : primaryKey
const base = process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1/chat/completions"
const PROBE_TIMEOUT_MS = Number(process.env.AI_PROBE_TIMEOUT_MS || 45_000)

// Every configured slot, primary AND fallback. Probing only primaries hid a
// retired fallback for months: the primary worked, so CI stayed green while a
// failure had nowhere to go. Keep this list in step with AI_ROUTES in
// src/lib/ai-router.ts (a test asserts the two tables agree).
const configured = [
  ["roadmap", process.env.NIM_ROADMAP_MODEL || "nvidia/nemotron-3-ultra-550b-a55b"],
  ["roadmap-fallback", process.env.NIM_ROADMAP_FALLBACK_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b"],
  ["lesson", process.env.NIM_LESSON_MODEL || "nvidia/nemotron-3-ultra-550b-a55b"],
  ["lesson-fallback", process.env.NIM_LESSON_FALLBACK_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b"],
  ["quiz", process.env.NIM_QUIZ_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b"],
  ["quiz-fallback", process.env.NIM_QUIZ_FALLBACK_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"],
  ["tutor", process.env.NIM_TUTOR_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b"],
  ["tutor-fallback", process.env.NIM_TUTOR_FALLBACK_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"],
  ["weakness", process.env.NIM_WEAKNESS_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b"],
  ["weakness-fallback", process.env.NIM_WEAKNESS_FALLBACK_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"],
  // Text probe only — it proves the model is served, not that it accepts
  // images. Vision is verified with a real image_url (see docs/AI_FAILOVER.md).
  ["vision", process.env.NIM_VISION_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"],
  ["vision-fallback", process.env.NIM_VISION_FALLBACK_MODEL || "nvidia/nemotron-3.5-bolt-e4b"],
]
const candidates = [
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  "nvidia/nemotron-3.5-bolt-e4b",
]
const extra = (process.env.AI_PROBE_MODELS || "")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean)

const formatProblems = []
const checkKey = (name, value) => {
  if (!value.startsWith("nvapi-")) formatProblems.push(`${name} does not start with nvapi-`)
  if (value.length < 50) formatProblems.push(`${name} is only ${value.length} characters (a full key is about 70)`)
}
if (!primaryKey) formatProblems.push("NVIDIA_NIM_API_KEY is not set")
else checkKey("NVIDIA_NIM_API_KEY", primaryKey)
if (secondaryKey) checkKey("NVIDIA_NIM_API_KEY_2", secondaryKey)
if (probeSlot === 2 && !secondaryKey) formatProblems.push("AI_PROBE_KEY=2 but NVIDIA_NIM_API_KEY_2 is not set")
if (formatProblems.length > 0) {
  console.error("✗ NIM key configuration looks invalid: " + formatProblems.join("; "))
  process.exit(1)
}

// Dedupe by model so a model used by several slots is probed once, while the
// role column still lists every slot that depends on it.
const targets = new Map()
for (const [role, model] of configured) {
  const roles = targets.get(model) ?? []
  roles.push(role)
  targets.set(model, roles)
}
for (const model of candidates) {
  if (!targets.has(model)) targets.set(model, ["candidate"])
}
for (const model of extra) targets.set(model, ["candidate"])

let configuredFailures = 0
let successes = 0
console.log(
  `Probing ${targets.size} models with key slot ${probeSlot}${secondaryKey ? " (a second key is configured)" : " (no second key configured)"}, ${PROBE_TIMEOUT_MS}ms cap each\n`
)

for (const [model, roles] of targets) {
  const role = roles.join("+")
  const isConfigured = !(roles.length === 1 && roles[0] === "candidate")
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
    console.log(`✗ ${role.padEnd(28)} ${model}: request failed after ${Date.now() - started}ms (${error instanceof Error ? error.message : error})`)
    if (isConfigured) configuredFailures++
    continue
  }

  const elapsed = Date.now() - started
  const body = await res.text()
  if (!res.ok) {
    let detail = body
    try {
      detail = JSON.parse(body)?.detail ?? body
    } catch {}
    console.log(`✗ ${role.padEnd(28)} ${model}: HTTP ${res.status} in ${elapsed}ms — ${String(detail).slice(0, 160)}`)
    if (isConfigured) configuredFailures++
    continue
  }

  let content = ""
  try {
    content = JSON.parse(body)?.choices?.[0]?.message?.content ?? ""
  } catch {
    content = body
  }
  if (!content.trim()) {
    console.log(`✗ ${role.padEnd(28)} ${model}: HTTP ${res.status} but empty reply in ${elapsed}ms`)
    if (isConfigured) configuredFailures++
    continue
  }
  const budget = Number(process.env.AI_PROBE_BUDGET_MS || 45_000)
  const verdict = elapsed > budget ? `⚠ slow (> ${budget}ms budget)` : "✓"
  console.log(`${verdict} ${role.padEnd(28)} ${model}: HTTP ${res.status} in ${elapsed}ms`)
  successes++
}

console.log(`\n${successes}/${targets.size} models usable.`)
if (configuredFailures > 0) {
  console.error(`${configuredFailures} configured model(s) failed — update NIM_*_MODEL env vars to a ✓ model above.`)
  process.exit(1)
}
