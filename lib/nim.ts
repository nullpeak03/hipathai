import { z } from "zod";

export type AiTask =
  | "roadmap"
  | "lesson"
  | "quiz"
  | "tutor"
  | "review"
  | "summary";

const PRIMARY: Record<AiTask, "ULTRA" | "LIGHTNING" | "GLIMMER"> = {
  roadmap: "ULTRA",
  tutor: "ULTRA",
  review: "ULTRA",
  lesson: "GLIMMER",
  quiz: "LIGHTNING",
  summary: "LIGHTNING",
};

function modelId(slot: "ULTRA" | "LIGHTNING" | "GLIMMER") {
  if (slot === "ULTRA") return process.env.NIM_ULTRA_ID!;
  if (slot === "LIGHTNING") return process.env.NIM_LIGHTNING_ID!;
  return process.env.NIM_GLIMMER_ID!;
}

function messageText(msg: { content?: unknown; reasoning_content?: unknown }): string {
  // Reasoning NIMs (Nemotron 3, Glimmer) put chain-of-thought in
  // `content` (Nemotron) or `reasoning_content` with content=null (Glimmer).
  const c = typeof msg.content === "string" ? msg.content : "";
  const r = typeof msg.reasoning_content === "string" ? msg.reasoning_content : "";
  return c.trim() ? c : r;
}

async function chatOnce(model: string, messages: { role: string; content: string }[], maxTokens: number, timeoutMs: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${process.env.NIM_BASE_URL ?? "https://integrate.api.nvidia.com/v1"}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NIM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.4 }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`nim_${res.status}`);
    const json = await res.json();
    const text: string = messageText(json.choices?.[0]?.message ?? {});
    if (!text.trim()) throw new Error("nim_empty");
    return text;
  } finally {
    clearTimeout(t);
  }
}

function isRetriable(e: unknown) {
  const m = String((e as Error)?.message ?? e);
  return /nim_429|nim_5|abort|timeout|empty|network/i.test(m);
}

// Fallback chain per plan.md: primary -> retry -> Lightning -> retry -> Glimmer -> error (no template).
// Total auto tries: 3. UI must show error + Retry Now (same id) + Back to Summary on throw.
export async function callAI<T>({
  task,
  schema,
  messages,
  maxTokens = 2000,
  log,
}: {
  task: AiTask;
  schema: z.ZodSchema<T>;
  messages: { role: string; content: string }[];
  maxTokens?: number;
  log?: (info: { provider: string; fallback: boolean; error?: string }) => void;
}): Promise<T> {
  const chain = Array.from(
    new Set< "ULTRA" | "LIGHTNING" | "GLIMMER">([PRIMARY[task], "LIGHTNING", "GLIMMER"]),
  );

  const stages: string[] = [];
  for (let i = 0; i < chain.length; i++) {
    const slot = chain[i];
    // Reasoning models (esp. Ultra 550B) need room for chain-of-thought + JSON.
    // Measured 2026-09: Ultra ~146s / Lightning ~82s for 3000-token outputs.
    const timeoutMs = slot === "ULTRA" ? 170000 : slot === "LIGHTNING" ? 60000 : 60000;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await chatOnce(modelId(slot), messages, i > 0 ? Math.floor(maxTokens / 2) : maxTokens, timeoutMs);
        const parsed = schema.safeParse(tryJson(raw));
        if (!parsed.success) {
          // One repair attempt with same model before moving down the chain
          const fixed = await chatOnce(
            modelId(slot),
            [...messages, { role: "user", content: `Fix this to valid JSON matching the schema, return JSON only:\n${raw}` }],
            800,
            45000,
          );
          const reparsed = schema.safeParse(tryJson(fixed));
          if (!reparsed.success) throw new Error("nim_invalid_json");
          log?.({ provider: slot, fallback: i > 0 });
          return reparsed.data;
        }
        log?.({ provider: slot, fallback: i > 0 });
        return parsed.data;
      } catch (e) {
        const msg = String((e as Error)?.message ?? e).slice(0, 80);
        stages.push(`${slot}#${attempt}:${msg}`);
        log?.({ provider: slot, fallback: i > 0, error: msg });
        if (!isRetriable(e) && String((e as Error)?.message).includes("invalid_json")) break;
        if (attempt === 0 && isRetriable(e)) continue; // same-model retry
        break; // move to next fallback
      }
    }
    if (i === 0) messages = [{ role: "system", content: "Be concise. Return JSON only." }, ...messages];
  }
  throw new Error(`nim_all_failed [${stages.join(" | ")}]`);
}

// Reasoning models wrap JSON in chain-of-thought prose (Nemotron writes it
// into content, Glimmer uses reasoning_content). Extract the first balanced
// {...} block so thinking text never breaks parsing.
function tryJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? raw).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    if (start < 0) throw new Error("nim_invalid_json");
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < candidate.length; i++) {
      const ch = candidate[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') {
        inStr = true;
      } else if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0) return JSON.parse(candidate.slice(start, i + 1));
      }
    }
    throw new Error("nim_invalid_json");
  }
}
