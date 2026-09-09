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
    // Real roadmap only — no template heal. If stuck generating > 5 min (old Hobby bug),
    // mark as failed so UI shows error card + Retry Now (same id) + Back to Summary.
    const ageMs = Date.now() - new Date((data as unknown as { created_at: string }).created_at).getTime();
    if (data.status === "generating" && ageMs > 5 * 60 * 1000) {
      await sb.from("roadmaps").update({ status: "failed" }).eq("id", id);
      return NextResponse.json({ id: data.id, status: "failed" });
    }
    return NextResponse.json({ id: data.id, status: data.status });
  }
  return NextResponse.json(data);
}
