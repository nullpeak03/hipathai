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

export const AI_ROUTES: Record<AiFeature, Route> = {
  roadmap: {
    model: process.env.NIM_ROADMAP_MODEL || "nvidia/nemotron-3-ultra-550b-a55b",
    timeoutMs: 240000,
    geminiPool: "roadmap",
    jsonKeys: ["phases"],
  },
  lesson: {
    model: process.env.NIM_LESSON_MODEL || "nvidia/nemotron-3-super-120b-a12b",
    timeoutMs: 120000,
    // Proven live 2026-09-22: without this flag super-120b streams reasoning
    // traces instead of the JSON contract (HTTP 200, unparseable).
    thinkingDisabled: true,
    geminiPool: "roadmap",
    jsonKeys: ["sections"],
  },
  quiz: {
    model: process.env.NIM_QUIZ_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b",
    timeoutMs: 22000,
    thinkingDisabled: true,
    geminiPool: "interactive",
    jsonKeys: ["questions"],
  },
  tutor: {
    model: process.env.NIM_TUTOR_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    timeoutMs: 20000,
    thinkingDisabled: true,
    geminiPool: "interactive",
    jsonKeys: [],
  },
  weakness: {
    model: process.env.NIM_WEAKNESS_MODEL || "meta/muse-glimmer-30b",
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
  const { jsonMode = false, maxTokens = 2000, retries = 1, timeoutMs } = opts
  const budget = timeoutMs ?? route.timeoutMs
  try {
    return await callNim({
      model: route.model,
      messages,
      jsonMode,
      jsonKeys: route.jsonKeys,
      timeoutMs: budget,
      maxTokens,
      thinkingDisabled: route.thinkingDisabled,
      retries,
    })
  } catch (e) {
    console.warn(
      `[ai-router] ${feature} primary (${route.model}) failed, falling back to Gemini:`,
      getErrorMessage(e).slice(0, 200)
    )
    return chatWithGemini(messages, jsonMode, budget, maxTokens, {
      key: route.geminiPool,
      retries,
      jsonKeys: route.jsonKeys,
    })
  }
}
