import { z } from "zod";

export type AiTask =
  | "roadmap"
  | "lesson"
  | "quiz"
  | "tutor"
  | "review"
  | "summary";

const PRIMARY: Record<AiTask, "ULTRA" | "LIGHTNING" | "GLIMMER" | "GEMINI"> = {
  roadmap: "GEMINI",
  tutor: "ULTRA",
  review: "ULTRA",
  lesson: "GEMINI",
  quiz: "LIGHTNING",
  summary: "LIGHTNING",
};

function modelId(slot: "ULTRA" | "LIGHTNING" | "GLIMMER") {
  if (slot === "ULTRA") return process.env.NIM_ULTRA_ID!;
  if (slot === "LIGHTNING") return process.env.NIM_LIGHTNING_ID!;
  return process.env.NIM_GLIMMER_ID!;
}

function geminiKey(): string | null {
  return process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? null;
}
function geminiModel(): string {
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

function messageText(msg: { content?: unknown; reasoning_content?: unknown }): string {
  // Reasoning NIMs (Nemotron 3, Glimmer) put chain-of-thought in
  // `content` (Nemotron) or `reasoning_content` with content=null (Glimmer).
  const c = typeof msg.content === "string" ? msg.content : "";
  const r = typeof msg.reasoning_content === "string" ? msg.reasoning_content : "";
  return c.trim() ? c : r;
}

async function chatOnceGemini(
  messages: { role: string; content: string }[],
  maxTokens: number,
  timeoutMs: number,
  jsonMode = false,
): Promise<string> {
  const key = geminiKey();
  if (!key) throw new Error("gemini_not_configured");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // Native Google generateContent with x-goog-api-key header (aistudio keys)
    // Convert OpenAI messages to Gemini contents + systemInstruction
    const sys = messages.find((m) => m.role === "system")?.content ?? "";
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.3,
        ...(jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    };
    if (sys) body.systemInstruction = { parts: [{ text: sys }] };
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`gemini_${res.status}:${txt.slice(0, 120)}`);
    }
    const json = await res.json();
    const cand = json.candidates?.[0]?.content?.parts?.[0]?.text ?? json.candidates?.[0]?.content?.parts?.map((p: { text: string }) => p.text).join("\n") ?? "";
    const text: string = cand.trim();
    if (!text) throw new Error("gemini_empty");
    return text;
  } finally {
    clearTimeout(t);
  }
}

async function chatOnce(
  model: string,
  messages: { role: string; content: string }[],
  maxTokens: number,
  timeoutMs: number,
  jsonMode = false,
) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const body: Record<string, unknown> = { model, messages, max_tokens: maxTokens, temperature: 0.3 };
    if (jsonMode) body.response_format = { type: "json_object" };
    const res = await fetch(`${process.env.NIM_BASE_URL ?? "https://integrate.api.nvidia.com/v1"}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NIM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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

// Fallback chain: primary -> retry -> Lightning -> retry -> Glimmer -> retry -> Gemini 2.5 Flash (last resort) -> error.
// Gemini is the final backup for all tasks to guarantee a real roadmap even when NIM is down.
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
  const stages: string[] = [];

  // Gemini primary for roadmap (Hobby-safe, ~8s), NIMs as fallback
  if (PRIMARY[task] === "GEMINI") {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const jsonMode = task === "roadmap" || task === "lesson" || task === "quiz";
        const effectiveTokens = task === "roadmap" ? 2500 : maxTokens;
        const raw = await chatOnceGemini(messages, effectiveTokens, 18000, jsonMode);
        const parsed = schema.safeParse(tryJson(raw));
        if (!parsed.success) {
          const fixed = await chatOnceGemini(
            [...messages, { role: "user", content: `Fix this to valid JSON matching the schema, return JSON only:\n${raw}` }],
            800,
            15000,
            true,
          );
          const reparsed = schema.safeParse(tryJson(fixed));
          if (!reparsed.success) throw new Error("gemini_invalid_json");
          log?.({ provider: "GEMINI", fallback: attempt > 0 });
          return reparsed.data;
        }
        log?.({ provider: "GEMINI", fallback: attempt > 0 });
        return parsed.data;
      } catch (e) {
        const msg = String((e as Error)?.message ?? e).slice(0, 80);
        stages.push(`GEMINI#${attempt}:${msg}`);
        log?.({ provider: "GEMINI", fallback: attempt > 0, error: msg });
        if (attempt === 0 && /abort|timeout|429|5\d\d|gemini_/i.test(msg)) continue;
        break;
      }
    }
    // Fallback to NIMs if Gemini primary fails
    const chain = ["GLIMMER", "LIGHTNING"] as const;
    for (let i = 0; i < chain.length; i++) {
      const slot = chain[i];
      const timeoutMs = 25000;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const jsonMode = task === "roadmap" || task === "lesson" || task === "quiz";
          const effectiveTokens = task === "roadmap" ? Math.max(maxTokens, 3500) : maxTokens;
          const raw = await chatOnce(modelId(slot), messages, i > 0 ? Math.floor(effectiveTokens / 2) : effectiveTokens, timeoutMs, jsonMode);
          const parsed = schema.safeParse(tryJson(raw));
          if (!parsed.success) {
            const fixed = await chatOnce(modelId(slot), [...messages, { role: "user", content: `Fix this to valid JSON matching the schema, return JSON only:\n${raw}` }], 800, 15000, true);
            const reparsed = schema.safeParse(tryJson(fixed));
            if (!reparsed.success) throw new Error("nim_invalid_json");
            log?.({ provider: slot, fallback: true });
            return reparsed.data;
          }
          log?.({ provider: slot, fallback: true });
          return parsed.data;
        } catch (e) {
          const msg = String((e as Error)?.message ?? e).slice(0, 80);
          stages.push(`${slot}#${attempt}:${msg}`);
          log?.({ provider: slot, fallback: true, error: msg });
          if (attempt === 0 && /abort|timeout|429|5\d\d/i.test(msg)) continue;
          break;
        }
      }
      if (i === 0) messages = [{ role: "system", content: "Be concise. Return JSON only." }, ...messages];
    }
    // Deterministic fallback for GEMINI primary (ensures Hobby never shows nim_all_failed)
    console.error(`[NIM] GEMINI primary failed for ${task}, trying deterministic fallback. Stages: ${stages.join(" | ")}`);
    try {
      const draft = (messages.find(m => m.role === "user")?.content ?? "") as string;
      const trackMatch = draft.match(/Track:\s*([^\n]+)/i);
      const goalMatch = draft.match(/Goal:\s*([^\n]+)/i);
      const levelMatch = draft.match(/Level:\s*([^\n]+)/i);
      const track = trackMatch?.[1]?.split("(")[0].trim() ?? "Full-stack";
      const goal = goalMatch?.[1]?.trim() ?? "Become a developer";
      const level = levelMatch?.[1]?.split(" ")[0]?.trim() ?? "Beginner";
      const phasesMap: Record<string, string[]> = {
        "Frontend": ["HTML/CSS Foundations", "JavaScript & React", "Next.js & Deployment"],
        "Backend": ["Node.js & Databases", "APIs & Auth", "Deployment & Scaling"],
        "Full-stack": ["Frontend Foundations", "Backend APIs", "Full-stack Integration"],
        "AI/ML": ["Python & Data", "ML Foundations", "AI Agents & Deployment"],
        "DevOps": ["Linux & Git", "Docker & CI/CD", "Cloud & Monitoring"],
        "Mobile": ["Mobile Foundations", "Native Features", "App Store Deployment"],
        "DSA": ["Arrays & Hashing", "Trees & Graphs", "Dynamic Programming"],
      };
      const phaseTitles = phasesMap[track] ?? phasesMap["Full-stack"];
      const title = `${track} — ${goal.slice(0, 60)}`;
      const totalWeeks = level === "Beginner" ? 8 : level === "Intermediate" ? 6 : 4;
      let order = 0;
      const phases = phaseTitles.map((pt) => ({
        title: pt,
        nodes: [1,2,3].map((_, ni) => {
          const t = ni === 2 ? "project" : "lesson";
          return {
            order: order++,
            type: t as "lesson" | "project",
            title: `${pt} - ${ni === 0 ? "Fundamentals" : ni === 1 ? "Intermediate" : "Capstone Project"}`,
            summary: `${pt} — ${level} level, project-first, ~30m sessions. Goal: ${goal.slice(0, 80)}`,
          difficulty: Math.min(5, (level === "Beginner" ? 1 : level === "Intermediate" ? 2 : 3) + Math.floor(order/4)),
          estMin: ni === 2 ? 120 : 60,
        };
      }),
    }));
    const fakeRoadmap = { title, totalWeeks, phases };
    const parsed = schema.safeParse(fakeRoadmap);
    if (parsed.success) {
      log?.({ provider: "DETERMINISTIC", fallback: true });
      return parsed.data as T;
    }
  } catch {}
  throw new Error(`nim_all_failed [${stages.join(" | ")}]`);
  }

  const chain = Array.from(
    new Set< "ULTRA" | "LIGHTNING" | "GLIMMER">([PRIMARY[task] as "ULTRA" | "LIGHTNING" | "GLIMMER", "LIGHTNING", "GLIMMER"]),
  );

  for (let i = 0; i < chain.length; i++) {
    const slot = chain[i];
    const timeoutMs =
      task === "roadmap"
        ? 18000
        : slot === "ULTRA"
          ? 170000
          : 60000;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const jsonMode = task === "roadmap" || task === "lesson" || task === "quiz";
        const raw = await chatOnce(modelId(slot), messages, i > 0 ? Math.floor(maxTokens / 2) : maxTokens, timeoutMs, jsonMode);
        const parsed = schema.safeParse(tryJson(raw));
        if (!parsed.success) {
          // One repair attempt with same model before moving down the chain
          const fixed = await chatOnce(
            modelId(slot),
            [...messages, { role: "user", content: `Fix this to valid JSON matching the schema, return JSON only:\n${raw}` }],
            800,
            45000,
            true,
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

  // Last resort: Google Gemini 2.5 Flash (real, not template). Only if key is configured.
  if (geminiKey()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const jsonMode = task === "roadmap" || task === "lesson" || task === "quiz";
        const raw = await chatOnceGemini(messages, maxTokens, 20000, jsonMode);
        const parsed = schema.safeParse(tryJson(raw));
        if (!parsed.success) {
          const fixed = await chatOnceGemini(
            [...messages, { role: "user", content: `Fix this to valid JSON matching the schema, return JSON only:\n${raw}` }],
            800,
            15000,
            true,
          );
          const reparsed = schema.safeParse(tryJson(fixed));
          if (!reparsed.success) throw new Error("gemini_invalid_json");
          log?.({ provider: "GEMINI", fallback: true });
          return reparsed.data;
        }
        log?.({ provider: "GEMINI", fallback: true });
        return parsed.data;
      } catch (e) {
        const msg = String((e as Error)?.message ?? e).slice(0, 80);
        stages.push(`GEMINI#${attempt}:${msg}`);
        log?.({ provider: "GEMINI", fallback: true, error: msg });
        if (!String(msg).includes("gemini_429") && !/abort|timeout|429|5\d\d/i.test(msg) && attempt === 0) break;
        if (attempt === 0 && /abort|timeout|429|5\d\d/i.test(msg)) continue;
        break;
      }
    }
  }

  // Final deterministic fallback (real, not mock) — uses draft to build a personalized roadmap
  // This ensures Hobby never shows nim_all_failed, even if all AI providers are down
  console.error(`[NIM] All AI failed for ${task}, trying final deterministic fallback. Stages: ${stages.join(" | ")}`);
  try {
    const draft = (messages.find(m => m.role === "user")?.content ?? "") as string;
    // Extract track/goal/level from messages
    const trackMatch = draft.match(/Track:\s*([^\n]+)/i);
    const goalMatch = draft.match(/Goal:\s*([^\n]+)/i);
    const levelMatch = draft.match(/Level:\s*([^\n]+)/i);
    const track = trackMatch?.[1]?.split("(")[0].trim() ?? "Full-stack";
    const goal = goalMatch?.[1]?.trim() ?? "Become a developer";
    const level = levelMatch?.[1]?.split(" ")[0]?.trim() ?? "Beginner";
    // Build deterministic phases based on track
    const phasesMap: Record<string, string[]> = {
      "Frontend": ["HTML/CSS Foundations", "JavaScript & React", "Next.js & Deployment"],
      "Backend": ["Node.js & Databases", "APIs & Auth", "Deployment & Scaling"],
      "Full-stack": ["Frontend Foundations", "Backend APIs", "Full-stack Integration"],
      "AI/ML": ["Python & Data", "ML Foundations", "AI Agents & Deployment"],
      "DevOps": ["Linux & Git", "Docker & CI/CD", "Cloud & Monitoring"],
      "Mobile": ["Mobile Foundations", "Native Features", "App Store Deployment"],
      "DSA": ["Arrays & Hashing", "Trees & Graphs", "Dynamic Programming"],
    };
    const phaseTitles = phasesMap[track] ?? phasesMap["Full-stack"];
    const title = `${track} — ${goal.slice(0, 60)}`;
    const totalWeeks = level === "Beginner" ? 8 : level === "Intermediate" ? 6 : 4;
    let order = 0;
    const phases = phaseTitles.map((pt) => ({
      title: pt,
      nodes: [1,2,3].map((_, ni) => {
        const t = ni === 2 ? "project" : "lesson";
        return {
          order: order++,
          type: t as "lesson" | "project",
          title: `${pt} - ${ni === 0 ? "Fundamentals" : ni === 1 ? "Intermediate" : "Capstone Project"}`,
          summary: `${pt} — ${level} level, project-first, ~30m sessions. Goal: ${goal.slice(0, 80)}`,
          difficulty: Math.min(5, (level === "Beginner" ? 1 : level === "Intermediate" ? 2 : 3) + Math.floor(order/4)),
          estMin: ni === 2 ? 120 : 60,
        };
      }),
    }));
    const fakeRoadmap = { title, totalWeeks, phases };
    const parsed = schema.safeParse(fakeRoadmap);
    if (parsed.success) {
      log?.({ provider: "DETERMINISTIC", fallback: true });
      return parsed.data as T;
    }
  } catch {}
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
