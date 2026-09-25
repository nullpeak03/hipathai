import { callNim, type ChatMessage } from "./nim"
import { getErrorMessage } from "./utils"

export type { ChatMessage }

// NIM-only provider routing (Gemini fallback removed 2026-09-25: its
// 20 req/min free-tier quota turned every NIM hiccup into a dead job).
// Each feature has a primary and a same-provider fallback model so one bad
// model can't take down a feature. Env overrides allow swapping models
// without a code change.
export type AiFeature = "roadmap" | "lesson" | "quiz" | "tutor" | "weakness"

type Route = {
  model: string
  fallbackModel: string
  timeoutMs: number
  thinkingDisabled?: boolean
  /** Array keys a valid response must contain for this feature's contract. */
  jsonKeys: string[]
}

// Live resolution per request — never cached at import time (Vercel/Inngest env may change without rebuild)
function resolveNimModel(feature: AiFeature): string {
  switch (feature) {
    case "roadmap": return process.env.NIM_ROADMAP_MODEL || "nvidia/nemotron-3-ultra-550b-a55b"
    case "lesson": return process.env.NIM_LESSON_MODEL || "nvidia/nemotron-3-super-120b-a12b"
    case "quiz": return process.env.NIM_QUIZ_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b"
    case "tutor": return process.env.NIM_TUTOR_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"
    case "weakness": return process.env.NIM_WEAKNESS_MODEL || "meta/muse-glimmer-30b"
  }
}

/** Second NVIDIA model tried when the primary fails (override via env). */
function resolveNimFallback(feature: AiFeature): string {
  switch (feature) {
    case "roadmap": return process.env.NIM_ROADMAP_FALLBACK_MODEL || "nvidia/nemotron-3-super-120b-a12b"
    case "lesson": return process.env.NIM_LESSON_FALLBACK_MODEL || "nvidia/nemotron-3-ultra-550b-a55b"
    case "quiz": return process.env.NIM_QUIZ_FALLBACK_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"
    case "tutor": return process.env.NIM_TUTOR_FALLBACK_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b"
    case "weakness": return process.env.NIM_WEAKNESS_FALLBACK_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b"
  }
}

export const AI_ROUTES: Record<AiFeature, Route> = {
  roadmap: {
    model: "nvidia/nemotron-3-ultra-550b-a55b",
    fallbackModel: "nvidia/nemotron-3-super-120b-a12b",
    timeoutMs: 240000,
    // Ultra is a reasoning variant: without this it streams chain-of-thought
    // instead of the JSON contract ("Invalid JSON from model" in prod logs).
    thinkingDisabled: true,
    jsonKeys: ["phases"],
  },
  lesson: {
    model: "nvidia/nemotron-3-super-120b-a12b",
    fallbackModel: "nvidia/nemotron-3-ultra-550b-a55b",
    timeoutMs: 120000,
    thinkingDisabled: true,
    jsonKeys: ["sections"],
  },
  quiz: {
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    fallbackModel: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    timeoutMs: 22000,
    thinkingDisabled: true,
    jsonKeys: ["questions"],
  },
  tutor: {
    model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    fallbackModel: "nvidia/nemotron-3.5-lightning-30b-a3b",
    timeoutMs: 20000,
    thinkingDisabled: true,
    jsonKeys: ["sections"],
  },
  weakness: {
    model: "meta/muse-glimmer-30b",
    fallbackModel: "nvidia/nemotron-3.5-lightning-30b-a3b",
    timeoutMs: 25000,
    thinkingDisabled: true,
    jsonKeys: [],
  },
}

export type ChatForFeatureOptions = {
  jsonMode?: boolean
  maxTokens?: number
  retries?: number
  /** Override the route's timeout (e.g. sync endpoints under Vercel limits). */
  timeoutMs?: number
}

/** NIM primary → NIM fallback (same provider). Throws only when both fail. */
export async function chatForFeature(
  feature: AiFeature,
  messages: ChatMessage[],
  opts: ChatForFeatureOptions = {}
): Promise<{ modelUsed: string; content: string }> {
  const route = AI_ROUTES[feature]
  const primary = resolveNimModel(feature)
  const fallback = resolveNimFallback(feature)
  const { jsonMode = false, maxTokens = 2000, retries = 2, timeoutMs } = opts
  const budget = timeoutMs ?? route.timeoutMs
  // Diagnosis: log which primary is attempted and whether NIM key exists (no secret)
  if (!process.env.NVIDIA_NIM_API_KEY) {
    // No second provider anymore — fail loud so the missing key gets fixed
    // instead of silently serving mock/fallback content.
    throw new Error("NIM_KEY_MISSING")
  }
  const attempt = (model: string) =>
    callNim({
      model,
      messages,
      jsonMode,
      jsonKeys: route.jsonKeys,
      timeoutMs: budget,
      maxTokens,
      thinkingDisabled: route.thinkingDisabled,
      retries,
    })
  console.log(`[ai-router] ${feature} primary attempting nim/${primary}`)
  try {
    const res = await attempt(primary)
    console.log(`[ai-router] ${feature} primary succeeded via ${res.modelUsed}`)
    return res
  } catch (e) {
    const msg = getErrorMessage(e)
    if (fallback === primary) throw e
    console.warn(
      `[ai-router] ${feature} primary (nim/${primary}) failed, trying fallback nim/${fallback}:`,
      msg.slice(0, 300)
    )
    const res = await attempt(fallback)
    console.log(`[ai-router] ${feature} fallback succeeded via ${res.modelUsed}`)
    return res
  }
}
