import { NextResponse } from "next/server";
import { callerId } from "@/lib/caller";
import { serviceClient } from "@/lib/store";

export const dynamic = "force-dynamic";

// Regenerate: archive the current ready roadmap (kept for history/Undo in v2),
// client then routes to /onboarding for a fresh draft.
export async function POST(req: Request) {
  const userKey = await callerId(req);
  const sb = serviceClient();
  const { error } = await sb
    .from("roadmaps")
    .update({ status: "archived" })
    .eq("user_id", userKey)
    .eq("status", "ready");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
