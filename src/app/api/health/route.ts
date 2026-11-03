import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET() {
  const checks: Record<string, "ok" | "fail"> = {}
  try {
    const supabase = createServerClient()
    const { error } = await supabase.from("users").select("id", { count: "exact", head: true })
    checks.database = error ? "fail" : "ok"
  } catch {
    checks.database = "fail"
  }
  checks.env = process.env.NVIDIA_NIM_API_KEY && process.env.CLERK_SECRET_KEY ? "ok" : "fail"
  const ok = Object.values(checks).every((v) => v === "ok")
  return NextResponse.json({ status: ok ? "ok" : "degraded", checks }, { status: ok ? 200 : 503 })
}