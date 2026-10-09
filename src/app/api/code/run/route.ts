import { NextRequest, NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { getErrorMessage } from "@/lib/utils"
import { runCode, runnerLanguage, MAX_RUN_CODE_CHARS } from "@/lib/code-runner"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"

// POST /api/code/run { language, code, stdin? } — open to all signed-in
// users within limits (30 runs/hour, 4000-char code, 20s timeout, truncated
// output); the owner (admin email) and is_pro accounts run unlimited.
// Order: auth → privilege check → rate limit (skipped if privileged) →
// validate → run. Lookup failures fall back to the limited tier, never deny.
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  let privileged = false
  try {
    const supabase = createServerClient()
    const [{ data: row }, user] = await Promise.all([
      supabase.from("users").select("is_pro").eq("clerk_id", userId).single(),
      (await clerkClient()).users.getUser(userId).catch(() => null),
    ])
    const isPro = (row as { is_pro?: boolean } | null)?.is_pro === true
    const primaryEmail = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? ""
    const adminEmail = (process.env.ADMIN_ALERT_EMAIL || "").toLowerCase()
    privileged = isPro || (!!adminEmail && !!primaryEmail && primaryEmail === adminEmail)
  } catch (e) {
    console.warn("[code/run] privilege check failed, limited tier:", getErrorMessage(e))
  }
  if (!privileged) {
    const rl = await checkRateLimit(`rl:${userId}:code`, RATE_LIMITS.code.limit, RATE_LIMITS.code.windowMs)
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many runs. Please wait a bit and try again." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
      )
    }
  }
  const { language, code, stdin } = (await req.json().catch(() => ({}))) as {
    language?: unknown
    code?: unknown
    stdin?: unknown
  }
  if (typeof language !== "string" || !runnerLanguage(language)) {
    return NextResponse.json({ error: "Unsupported language for running." }, { status: 400 })
  }
  if (typeof code !== "string" || code.trim().length === 0) {
    return NextResponse.json({ error: "Nothing to run." }, { status: 400 })
  }
  if (code.length > MAX_RUN_CODE_CHARS) {
    return NextResponse.json({ error: `Code is too long (max ${MAX_RUN_CODE_CHARS} chars).` }, { status: 400 })
  }
  try {
    const result = await runCode(language, code, typeof stdin === "string" ? stdin : "")
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }
    return NextResponse.json(result)
  } catch (e) {
    console.error("[code/run] failed:", getErrorMessage(e))
    return NextResponse.json({ error: "Runner failed. Try again in a minute." }, { status: 500 })
  }
}
