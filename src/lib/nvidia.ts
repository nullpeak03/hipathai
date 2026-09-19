// Nvidia NIMs fallback client — nvidia-only per V1 decision
let rawBase = process.env.NVIDIA_NIM_BASE_URL || process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1/chat/completions"
if (rawBase.endsWith("/v1") || rawBase.endsWith("/v1/")) rawBase = rawBase.replace(/\/$/, "") + "/chat/completions"
const NIM_BASE = rawBase
// Production model chain: only gpt-oss-20b which is most reliable
const FALLBACK_MODELS = (process.env.NIM_FALLBACK_MODELS || "openai/gpt-oss-20b").split(",").map(s=>s.trim())
const NIM_KEY = process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY || ""
// Per-model timeouts (ms) - sync calls must stay under Vercel 10s limit
// For Inngest function calls, use longer timeout via optional parameter
const MODEL_TIMEOUTS: Record<string, number> = {
  "openai/gpt-oss-20b": 8000,
}

export type ChatMessage = { role: "system"|"user"|"assistant", content: string }

export async function chatWithFallback(messages: ChatMessage[], jsonMode=false, timeoutMs?: number): Promise<{modelUsed:string, content:string}> {
  if (!NIM_KEY) throw new Error("NIM_KEY_MISSING")
  for (const model of FALLBACK_MODELS) {
    try {
      const controller = new AbortController()
      const modelTimeout = timeoutMs ?? MODEL_TIMEOUTS[model] ?? 8000
      const timeout = setTimeout(()=>controller.abort(), modelTimeout)
      const res = await fetch(NIM_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${NIM_KEY}` },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 2000,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
          stream: false
        }),
        signal: controller.signal
      })
      clearTimeout(timeout)
      if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`)
      const data = await res.json()
      const raw = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.message?.reasoning
      if (!raw) throw new Error("Empty content")
      let content = raw
      // Strip markdown code fences if present
      if (content.startsWith("```")) {
        const ending = content.indexOf("\n", 7)
        content = ending !== -1 ? content.substring(ending + 1) : content.substring(7)
        content = content.replace(/```$/, "").trim()
      }
      // Strip "Here's a thinking process:" and similar prefixes
      const prefixes = ["Here's a thinking process:", "Here is a thinking process:", "Thinking Process:"]
      for (const p of prefixes) {
        if (content.startsWith(p)) {
          content = content.substring(p.length).trim()
          break
        }
      }
      // Find the last '{' that starts a JSON object and extract from there
      const lastBrace = content.lastIndexOf("{")
      if (lastBrace > 0) content = content.substring(lastBrace)
      // Final fallback: try to find any {...} pattern
      if (!content.startsWith("{")) {
        const m = content.match(/\{.*\}/)
        if (m) content = m[0]
      }
      if (jsonMode) {
        try { JSON.parse(content) } catch { throw new Error("Invalid JSON from model") }
      }
      return { modelUsed: model, content }
    } catch (e) {
      console.warn(`[nvidia] ${model} failed:`, e instanceof Error ? e.message : e)
      continue
    }
  }
  throw new Error("ALL_MODELS_FAILED")
}

// streaming with fallback (async/Inngest path can use longer timeouts)
export async function* streamWithFallback(messages: ChatMessage[], isAsync=false, maxTokens=4000): AsyncGenerator<string> {
  // try models sequentially until one streams successfully
  for (const model of FALLBACK_MODELS) {
    try {
      const controller = new AbortController()
      const modelTimeout = isAsync ? 60000 : (MODEL_TIMEOUTS[model] ?? 8000)
      const timeout = setTimeout(()=>controller.abort(), modelTimeout)
      const res = await fetch(NIM_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${NIM_KEY}` },
        body: JSON.stringify({ model, messages, stream: true, temperature: 0.7, max_tokens: maxTokens }),
        signal: controller.signal
      })
      clearTimeout(timeout)
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
      // if got body, yield chunks
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      // yield marker
      yield `__MODEL__:${model}\n`
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        // parse SSE
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim()
            if (data === "[DONE]") return
            try {
              const json = JSON.parse(data)
              const delta = json.choices?.[0]?.delta?.content
              if (delta) yield delta
            } catch {}
          }
        }
      }
      return
    } catch (e) {
      console.warn(`[nvidia-stream] ${model} failed:`, e instanceof Error ? e.message : e)
      continue
    }
  }
  throw new Error("ALL_MODELS_FAILED_STREAM")
}
