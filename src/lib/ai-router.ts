import { callNim, type ChatMessage } from "./nim"
import { chatWithGemini, type GeminiKeyKind } from "./gemini"
import { getErrorMessage } from "./utils"

export type { ChatMessage }

// Per-feature provider routing. NIMs primaries verified live 2026-09-20
// (HTTP 200 on the project key); Gemini is the universal fallback so one
// provider can never take down all features. Env overrides allow swapping
// models without a code change.
export type AiFeature = "roadmap" | "lesson" | "quiz" | "tutor" | "weakness"

type Route = {
  model: string
  timeoutMs: number
  thinkingDisabled?: boolean
  geminiPool: GeminiKeyKind
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

export const AI_ROUTES: Record<AiFeature, Route> = {
  roadmap: {
    model: "nvidia/nemotron-3-ultra-550b-a55b",
    timeoutMs: 240000,
    geminiPool: "roadmap",
    jsonKeys: ["phases"],
  },
  lesson: {
    model: "nvidia/nemotron-3-super-120b-a12b",
    timeoutMs: 120000,
    thinkingDisabled: true,
    geminiPool: "roadmap",
    jsonKeys: ["sections"],
  },
  quiz: {
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    timeoutMs: 22000,
    thinkingDisabled: true,
    geminiPool: "interactive",
    jsonKeys: ["questions"],
  },
  tutor: {
    model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    timeoutMs: 20000,
    thinkingDisabled: true,
    geminiPool: "interactive",
    jsonKeys: ["sections"],
  },
  weakness: {
    model: "meta/muse-glimmer-30b",
    timeoutMs: 25000,
    thinkingDisabled: true,
    geminiPool: "interactive",
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

/** NIMs primary → Gemini fallback. Throws only when both fail. */
export async function chatForFeature(
  feature: AiFeature,
  messages: ChatMessage[],
  opts: ChatForFeatureOptions = {}
): Promise<{ modelUsed: string; content: string }> {
  const route = AI_ROUTES[feature]
  const nimModel = resolveNimModel(feature)
  const { jsonMode = false, maxTokens = 2000, retries = 1, timeoutMs } = opts
  const budget = timeoutMs ?? route.timeoutMs
  // Diagnosis: log which primary is attempted and whether NIM key exists (no secret)
  if (!process.env.NVIDIA_NIM_API_KEY) {
    console.warn(`[ai-router] ${feature} NIM_KEY_MISSING — will fallback to Gemini (set NVIDIA_NIM_API_KEY in Vercel + Inngest env)`)
  } else {
    console.log(`[ai-router] ${feature} primary attempting nim/${nimModel}`)
  }
  try {
    const res = await callNim({
      model: nimModel,
      messages,
      jsonMode,
      jsonKeys: route.jsonKeys,
      timeoutMs: budget,
      maxTokens,
      thinkingDisabled: route.thinkingDisabled,
      retries,
    })
    console.log(`[ai-router] ${feature} primary succeeded via ${res.modelUsed}`)
    return res
  } catch (e) {
    const msg = getErrorMessage(e)
    console.warn(
      `[ai-router] ${feature} primary (nim/${nimModel}) failed, falling back to Gemini:`,
      msg.slice(0, 300)
    )
    // Fail loud if primary was misconfigured — helps diagnose 429 on Gemini when Nim was never reached
    if (msg.includes("NIM_KEY_MISSING")) {
      console.error(`[ai-router] FIX: Set NVIDIA_NIM_API_KEY (+ NIM_*_MODEL) in Vercel Production & Inngest env and redeploy + re-sync. Models expected: roadmap=nvidia/nemotron-3-ultra-550b-a55b, lesson=nvidia/nemotron-3-super-120b-a12b, quiz=nvidia/nemotron-3.5-lightning-30b-a3b, tutor=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning, weakness=meta/muse-glimmer-30b`)
    }
    return chatWithGemini(messages, jsonMode, budget, maxTokens, {
      key: route.geminiPool,
      retries,
      jsonKeys: route.jsonKeys,
    })
  }
}
