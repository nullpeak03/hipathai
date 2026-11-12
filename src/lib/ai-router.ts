import { callNim, type ChatMessage } from "./nim"
import { getErrorMessage } from "./utils"

export type { ChatMessage }

// NIM-only provider routing (Gemini fallback removed 2026-09-25: its
// 20 req/min free-tier quota turned every NIM hiccup into a dead job).
// Each feature has a primary and a same-provider fallback model so one bad
// model can't take down a feature. Env overrides allow swapping models
// without a code change.
export type AiFeature = "roadmap" | "lesson" | "quiz" | "tutor" | "weakness" | "vision"

type Route = {
  model: string
  fallbackModel: string
  timeoutMs: number
  thinkingDisabled?: boolean
  /** Array keys a valid response must contain for this feature's contract. */
  jsonKeys: string[]
  /**
   * Accept prose replies (skip strict JSON validation). Only for consumers
   * whose parser tolerates raw text — currently tutor alone.
   */
  lenientJson?: boolean
}

// Live resolution per request — never cached at import time (Vercel/Inngest env may change without rebuild)
function resolveNimModel(feature: AiFeature): string {
  switch (feature) {
    case "roadmap": return process.env.NIM_ROADMAP_MODEL || "nvidia/nemotron-3-ultra-550b-a55b"
    case "lesson": return process.env.NIM_LESSON_MODEL || "nvidia/nemotron-3-super-120b-a12b"
    // Nano is the quiz primary as of 2026-10-17: live probes measured Lightning
    // at >40s for even 400 completion tokens (truncated, unparseable) while
    // Nano returned a valid 5-question bank in 13s. Env override reverts it.
    case "quiz": return process.env.NIM_QUIZ_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b"
    case "tutor": return process.env.NIM_TUTOR_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b"
    case "weakness": return process.env.NIM_WEAKNESS_MODEL || "meta/muse-glimmer-30b"
    case "vision": return process.env.NIM_VISION_MODEL || "nvidia/nemotron-3.5-super-vl"
  }
}

/** Second NVIDIA model tried when the primary fails (override via env). */
function resolveNimFallback(feature: AiFeature): string {
  switch (feature) {
    case "roadmap": return process.env.NIM_ROADMAP_FALLBACK_MODEL || "nvidia/nemotron-3-super-120b-a12b"
    case "lesson": return process.env.NIM_LESSON_FALLBACK_MODEL || "nvidia/nemotron-3-ultra-550b-a55b"
    case "quiz": return process.env.NIM_QUIZ_FALLBACK_MODEL || "nvidia/nemotron-3-super-120b-a12b"
    case "tutor": return process.env.NIM_TUTOR_FALLBACK_MODEL || "nvidia/nemotron-3-super-120b-a12b"
    case "weakness": return process.env.NIM_WEAKNESS_FALLBACK_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b"
    case "vision": return process.env.NIM_VISION_FALLBACK_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"
  }
}

export const AI_ROUTES: Record<AiFeature, Route> = {
  roadmap: {
    model: "nvidia/nemotron-3-ultra-550b-a55b",
    fallbackModel: "nvidia/nemotron-3-super-120b-a12b",
    timeoutMs: 45000,
    // Ultra is a reasoning variant: without this it streams chain-of-thought
    // instead of the JSON contract ("Invalid JSON from model" in prod logs).
    thinkingDisabled: true,
    jsonKeys: ["phases"],
  },
  lesson: {
    model: "nvidia/nemotron-3-super-120b-a12b",
    fallbackModel: "nvidia/nemotron-3-ultra-550b-a55b",
    timeoutMs: 45000,
    thinkingDisabled: true,
    jsonKeys: ["sections"],
  },
  quiz: {
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    fallbackModel: "nvidia/nemotron-3-super-120b-a12b",
    timeoutMs: 60000,
    thinkingDisabled: true,
    jsonKeys: ["questions"],
  },
  tutor: {
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    fallbackModel: "nvidia/nemotron-3-super-120b-a12b",
    timeoutMs: 30000,
    thinkingDisabled: true,
    jsonKeys: ["sections"],
    // Tutor replies are paragraph-wrapped downstream even as raw prose —
    // never fail a chat on JSON shape (prod: bare-block replies died here).
    lenientJson: true,
  },
  weakness: {
    model: "meta/muse-glimmer-30b",
    fallbackModel: "nvidia/nemotron-3.5-lightning-30b-a3b",
    timeoutMs: 25000,
    thinkingDisabled: true,
    jsonKeys: [],
  },
  vision: {
    model: "nvidia/nemotron-3.5-super-vl",
    fallbackModel: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    timeoutMs: 30000,
    thinkingDisabled: true,
    jsonKeys: [],
    // Vision returns prose descriptions of images, not strict JSON —
    // never fail a chat on JSON shape.
    lenientJson: true,
  },
}

export type ChatForFeatureOptions = {
  jsonMode?: boolean
  maxTokens?: number
  /**
   * In-call retries of the SAME model (multiplies cost — keep 0 and let the
   * Inngest function retry re-run just the failed step).
   */
  retries?: number
  /** Per-attempt timeout (override the route's default). */
  timeoutMs?: number
  /** Override the route's prose tolerance (default: route setting). */
  lenientJson?: boolean
  /**
   * Override the route's contract keys. Required when one feature makes
   * multiple shapes of call — e.g. roadmap outline returns {phases} but
   * phase expansion returns {lessons}. Without this, validation rejects
   * perfectly good JSON ("Invalid JSON from model" on every phase call).
   */
  jsonKeys?: string[]
  /**
   * Total wall-clock budget for primary + fallback combined. Defaults to
   * 50s so no single step can exceed the platform's ~60s invocation cap.
   * The fallback is SKIPPED when the remaining budget can't fit a usable
   * call, which is what lets the primary run long enough for big
   * generations without risking the cap.
   */
  deadlineMs?: number
  /**
   * How long the primary may stay silent before the fallback is raced in
   * parallel. Defaults to 55% of the deadline; exposed for tests and for
   * tuning a single slow route.
   */
  hedgeAfterMs?: number
}

/** Wall-clock budget for primary + fallback; keeps one step under the cap. */
const DEFAULT_DEADLINE_MS = 50000
/** Below this, a fallback call can't return a usable answer — don't start one. */
const MIN_FALLBACK_MS = 6000
/**
 * Share of the deadline a silent primary may consume before the fallback is
 * started in parallel. Slow reasoning models can otherwise eat the entire
 * budget, leaving the fallback no window at all — every roadmap phase then
 * dies as a "timeout" even though the fast model would have answered.
 */
const HEDGE_RATIO = 0.55

/** NIM primary → NIM fallback (same provider). Throws only when both fail. */
export async function chatForFeature(
  feature: AiFeature,
  messages: ChatMessage[],
  opts: ChatForFeatureOptions = {}
): Promise<{ modelUsed: string; content: string }> {
  const route = AI_ROUTES[feature]
  const primary = resolveNimModel(feature)
  const fallback = resolveNimFallback(feature)
  // One attempt by default: in-call retries compound the timeout and are the
  // reason steps used to blow past the platform invocation cap.
  const { jsonMode = false, maxTokens = 2000, retries = 0, timeoutMs } = opts
  const budget = timeoutMs ?? route.timeoutMs
  const deadlineMs = opts.deadlineMs ?? DEFAULT_DEADLINE_MS
  const startedAt = Date.now()
  const deadlineAt = startedAt + deadlineMs
  const elapsed = () => Date.now() - startedAt
  const remaining = () => deadlineAt - Date.now()
  const jsonKeys = opts.jsonKeys ?? route.jsonKeys
  // Diagnosis: log which primary is attempted and whether NIM key exists (no secret)
  if (!process.env.NVIDIA_NIM_API_KEY) {
    // No second provider anymore — fail loud so the missing key gets fixed
    // instead of silently serving mock/fallback content.
    throw new Error("NIM_KEY_MISSING")
  }
  const attempt = (model: string, callTimeoutMs: number) =>
    callNim({
      model,
      messages,
      jsonMode,
      jsonKeys,
      timeoutMs: callTimeoutMs,
      // Shared absolute deadline: internal retries must never push this step
      // past the invocation cap.
      deadlineAt,
      maxTokens,
      thinkingDisabled: route.thinkingDisabled,
      retries,
      allowRaw: opts.lenientJson ?? route.lenientJson ?? false,
    })

  console.log(`[ai-router] ${feature} primary attempting nim/${primary}`)

  // Hedge: if the primary is still silent after HEDGE_RATIO of the budget,
  // start the fallback in parallel and take whichever model answers first.
  // A healthy primary never pays for this (the timer is cleared on success).
  const canHedge = fallback !== primary && deadlineMs >= MIN_FALLBACK_MS * 2
  const defaultHedge = canHedge
    ? Math.min(Math.max(1, Math.floor(deadlineMs * HEDGE_RATIO)), deadlineMs - MIN_FALLBACK_MS)
    : Number.POSITIVE_INFINITY
  const hedgeMs = opts.hedgeAfterMs !== undefined
    ? Math.max(0, Math.min(opts.hedgeAfterMs, deadlineMs))
    : defaultHedge

  return await new Promise<{ modelUsed: string; content: string }>((resolve, reject) => {
    let settled = false
    let fallbackStarted = false
    let primaryError: unknown = null
    let fallbackError: unknown = null

    let hedgeTimer: ReturnType<typeof setTimeout> | undefined
    const finish = (action: () => void) => {
      if (settled) return
      settled = true
      if (hedgeTimer !== undefined) clearTimeout(hedgeTimer)
      action()
    }

    const startFallback = () => {
      if (fallbackStarted || settled) return
      fallbackStarted = true
      const callTimeout = Math.max(1, Math.min(budget, remaining()))
      console.warn(
        `[ai-router] ${feature} primary (nim/${primary}) still pending after ${elapsed()}ms — racing fallback nim/${fallback} (${callTimeout}ms)`
      )
      attempt(fallback, callTimeout).then(
        (res) => {
          console.log(`[ai-router] ${feature} fallback succeeded via ${res.modelUsed} in ${elapsed()}ms`)
          finish(() => resolve(res))
        },
        (err) => {
          fallbackError = err
          // Primary already failed too — surface its error (the model the
          // feature is tuned for), now that both routes are exhausted.
          if (primaryError !== null) finish(() => reject(primaryError))
        }
      )
    }

    if (Number.isFinite(hedgeMs)) {
      hedgeTimer = setTimeout(startFallback, Math.max(0, hedgeMs))
    }

    attempt(primary, Math.min(budget, Math.max(1, deadlineMs))).then(
      (res) => {
        console.log(`[ai-router] ${feature} primary succeeded via ${res.modelUsed} in ${elapsed()}ms`)
        finish(() => resolve(res))
      },
      (err) => {
        primaryError = err
        if (settled) return
        if (!fallbackStarted) {
          if (hedgeTimer !== undefined) clearTimeout(hedgeTimer)
          const left = remaining()
          if (fallback === primary || left < MIN_FALLBACK_MS) {
            console.warn(
              `[ai-router] ${feature} primary (nim/${primary}) failed with only ${left}ms of a ${deadlineMs}ms deadline left — skipping fallback:`,
              getErrorMessage(err).slice(0, 300)
            )
            finish(() => reject(err))
            return
          }
          console.warn(
            `[ai-router] ${feature} primary (nim/${primary}) failed, trying fallback nim/${fallback} (${Math.min(budget, left)}ms):`,
            getErrorMessage(err).slice(0, 300)
          )
          startFallback()
        } else if (fallbackError !== null) {
          // Fallback already failed while the primary was still running.
          finish(() => reject(err))
        }
      }
    )
  })
}
