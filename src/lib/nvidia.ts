// Nvidia NIMs fallback client — nvidia-only per V1 decision
const NIM_BASE = process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1/chat/completions"
const FALLBACK_MODELS = (process.env.NIM_FALLBACK_MODELS || "meta/llama-3.1-405b-instruct,nvidia/llama-3.1-nemotron-70b-instruct,meta/llama-3.1-70b-instruct,mistralai/mixtral-8x22b-instruct-v0.1,google/gemma-2-27b-it").split(",").map(s=>s.trim())
const NIM_KEY = process.env.NVIDIA_NIM_API_KEY || process.env.NIM_API_KEY || ""

export type ChatMessage = { role: "system"|"user"|"assistant", content: string }

export async function chatWithFallback(messages: ChatMessage[], jsonMode=false): Promise<{modelUsed:string, content:string}> {
  if (!NIM_KEY) throw new Error("NIM_KEY_MISSING")
  for (const model of FALLBACK_MODELS) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(()=>controller.abort(), 25000)
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
      const content = data.choices?.[0]?.message?.content
      if (!content) throw new Error("Empty content")
      if (jsonMode) JSON.parse(content) // validate
      return { modelUsed: model, content }
    } catch (e:any) {
      console.warn(`[nvidia] ${model} failed:`, e.message)
      continue
    }
  }
  throw new Error("ALL_MODELS_FAILED")
}

// streaming with fallback
export async function* streamWithFallback(messages: ChatMessage[]) {
  // try models sequentially until one streams successfully
  for (const model of FALLBACK_MODELS) {
    try {
      const res = await fetch(NIM_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${NIM_KEY}` },
        body: JSON.stringify({ model, messages, stream: true, temperature: 0.7 })
      })
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
    } catch (e:any) {
      console.warn(`[nvidia-stream] ${model} failed:`, e.message)
      continue
    }
  }
  throw new Error("ALL_MODELS_FAILED_STREAM")
}
