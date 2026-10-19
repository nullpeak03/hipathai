import { chatForFeature, type ChatMessage } from "./ai-router"

export type AiUsageEvent = {
  feature: string
  model: string
  durationMs: number
  ok: boolean
  error?: string
}

const usageEvents: AiUsageEvent[] = []

export function getAiUsageEvents(): AiUsageEvent[] {
  return [...usageEvents]
}

export async function runAiFeature(
  feature: Parameters<typeof chatForFeature>[0],
  messages: ChatMessage[],
  options?: Parameters<typeof chatForFeature>[2]
) {
  const started = Date.now()
  try {
    const result = await chatForFeature(feature, messages, options)
    usageEvents.push({
      feature,
      model: result.modelUsed,
      durationMs: Date.now() - started,
      ok: true,
    })
    return result
  } catch (e) {
    usageEvents.push({
      feature,
      model: "unknown",
      durationMs: Date.now() - started,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    })
    throw e
  }
}
