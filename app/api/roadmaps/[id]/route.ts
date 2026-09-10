import { NextResponse } from "next/server";
import { callerId } from "@/lib/caller";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "no_store" }, { status: 404 });
  }
  const userKey = await callerId(req);
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data, error } = await sb
    .from("roadmaps")
    .select("id,status,version,title,nodes,goal,created_at")
    .eq("id", id)
    .eq("user_id", userKey)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "store_failed", detail: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (data.status !== "ready") {
    // If stuck generating > 45s (Hobby after() should have finished in ~8s),
    // mark as failed so UI shows error card + Retry Now quickly instead of
    // polling for 6 minutes. This heals the FUNCTION_INVOCATION_TIMEOUT case.
    const ageMs = Date.now() - new Date((data as unknown as { created_at: string }).created_at).getTime();
    if (data.status === "generating" && ageMs > 45 * 1000) {
      await sb.from("roadmaps").update({ status: "failed" }).eq("id", id);
      return NextResponse.json({ id: data.id, status: "failed" });
    }
    return NextResponse.json({ id: data.id, status: data.status });
  }
  return NextResponse.json(data);
}
