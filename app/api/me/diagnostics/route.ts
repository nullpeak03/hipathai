import { NextResponse } from "next/server";
import { callerId } from "@/lib/caller";
import { serviceClient } from "@/lib/store";

export const dynamic = "force-dynamic";

// Diagnostics feed for Settings (plan §5): recent ai_logs with fallback flags.
export async function GET(req: Request) {
  const userKey = await callerId(req);
  const sb = serviceClient();
  const { data, error } = await sb
    .from("ai_logs")
    .select("task,provider,latency_ms,fallback_used,error_code,ts")
    .eq("user_id", userKey)
    .order("ts", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}
