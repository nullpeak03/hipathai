import { NextResponse } from "next/server";
import { callerId } from "@/lib/caller";
import { serviceClient } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userKey = await callerId(req);
  const sb = serviceClient();
  const [u, r, e, t, l] = await Promise.all([
    sb.from("users").select("*").eq("clerk_id", userKey).maybeSingle(),
    sb.from("roadmaps").select("*").eq("user_id", userKey),
    sb.from("progress_events").select("*").eq("user_id", userKey),
    sb.from("tutor_threads").select("*").eq("user_id", userKey),
    sb.from("ai_logs").select("*").eq("user_id", userKey).limit(100),
  ]);
  return NextResponse.json(
    { user: u.data, roadmaps: r.data, progress: e.data, tutor: t.data, aiLogs: l.data, exportedAt: new Date().toISOString() },
    { headers: { "Content-Disposition": "attachment; filename=hipath-export.json" } },
  );
}

// Delete: Supabase cascade first, then Clerk user (best-effort).
export async function DELETE(req: Request) {
  const userKey = await callerId(req);
  const sb = serviceClient();
  await sb.from("users").delete().eq("clerk_id", userKey);
  if (process.env.CLERK_SECRET_KEY && !userKey.startsWith("anon:")) {
    try {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const clerk = await clerkClient();
      await clerk.users.deleteUser(userKey);
    } catch { /* Supabase data already gone; auth cleanup best-effort */ }
  }
  return NextResponse.json({ ok: true });
}
