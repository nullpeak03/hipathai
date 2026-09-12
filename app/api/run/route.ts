import { NextResponse } from "next/server";
import { z } from "zod";
import { callerId } from "@/lib/caller";
import { checkAiDayAsync } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const LANG_MAP: Record<string, string> = {
  python: "python", py: "python",
  javascript: "javascript", js: "javascript", "next.js": "javascript", react: "javascript",
  typescript: "typescript", ts: "typescript",
  c: "c", "c++": "cpp", cpp: "cpp",
  java: "java", go: "go", rust: "rust",
  csharp: "csharp", "c#": "csharp",
  php: "php", ruby: "ruby", swift: "swift", kotlin: "kotlin",
  bash: "bash", shell: "bash", sh: "bash",
  sql: "sqlite", sqlite: "sqlite", postgres: "sqlite", postgresql: "sqlite",
};

let runtimesCache: { list: { language: string; version: string }[]; at: number } | null = null;

const Body = z.object({
  language: z.string().min(2).max(30),
  code: z.string().min(1).max(15000),
  stdin: z.string().max(5000).optional().default(""),
});

export async function POST(req: Request) {
  const userKey = await callerId(req);
  if (userKey.startsWith("anon:")) return NextResponse.json({ error: "unauthorized", message: "Sign in required" }, { status: 401 });
  const day = await checkAiDayAsync(userKey);
  if (!day.ok) return NextResponse.json({ error: "daily_limit", message: "Run limit 20/day" }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  const { language: rawLang, code, stdin } = parsed.data;
  const lang = LANG_MAP[rawLang.toLowerCase().trim()] ?? rawLang.toLowerCase().trim();

  // Resolve version
  let version = "*";
  try {
    if (!runtimesCache || Date.now() - runtimesCache.at > 24 * 3600 * 1000) {
      const r = await fetch("https://emkc.org/api/v2/piston/runtimes", { next: { revalidate: 86400 } });
      if (r.ok) {
        const list = (await r.json()) as { language: string; version: string }[];
        runtimesCache = { list, at: Date.now() };
      }
    }
    const found = runtimesCache?.list.find((x) => x.language === lang);
    if (found) version = found.version;
  } catch {}

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: lang,
        version,
        files: [{ content: code }],
        stdin: stdin ?? "",
        run_timeout: 3000,
        compile_timeout: 5000,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json({ error: "piston_error", detail: txt.slice(0, 300) }, { status: 502 });
    }
    const j = await res.json();
    return NextResponse.json({
      language: lang,
      version: j.version ?? version,
      stdout: j.run?.stdout ?? "",
      stderr: j.run?.stderr ?? "",
      output: j.run?.output ?? "",
      code: j.run?.code ?? 0,
      signal: j.run?.signal ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "piston_timeout";
    if (/abort/i.test(msg)) return NextResponse.json({ error: "timeout", message: "Execution timed out (8s)" }, { status: 504 });
    return NextResponse.json({ error: "piston_failed", detail: msg.slice(0, 200) }, { status: 502 });
  } finally {
    clearTimeout(t);
  }
}
