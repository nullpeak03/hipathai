import { NextResponse } from "next/server";
import { Webhook } from "svix";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook_not_configured" }, { status: 500 });

  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let evt: { type: string; data: { id: string } };
  try {
    const wh = new Webhook(secret);
    evt = wh.verify(payload, headers) as typeof evt;
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  if (evt.type === "user.created") {
    await sb.from("users").upsert({ clerk_id: evt.data.id }, { onConflict: "clerk_id" });
  } else if (evt.type === "user.deleted") {
    await sb.from("users").delete().eq("clerk_id", evt.data.id);
  } else if (evt.type === "user.updated") {
    // Sync display_name if changed, keep existing
    await sb.from("users").upsert({ clerk_id: evt.data.id }, { onConflict: "clerk_id" });
  }

  return NextResponse.json({ ok: true });
}
