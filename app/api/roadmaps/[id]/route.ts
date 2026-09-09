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
    .select("id,status,version,title,nodes,goal")
    .eq("id", id)
    .eq("user_id", userKey)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "store_failed", detail: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (data.status !== "ready") return NextResponse.json({ id: data.id, status: data.status });
  return NextResponse.json(data);
}
