import { NextResponse } from "next/server";
import { z } from "zod";
import { callerId } from "@/lib/caller";
import { serviceClient } from "@/lib/store";

export const dynamic = "force-dynamic";

const Patch = z.object({
  goal: z.string().min(4).max(300).optional(),
  hrsPerDay: z.number().int().min(1).max(12).optional(),
  daysPerWeek: z.number().int().min(2).max(7).optional(),
  sessionMin: z.union([z.literal(15), z.literal(30), z.literal(60)]).optional(),
});

export async function GET(req: Request) {
  const userKey = await callerId(req);
  const sb = serviceClient();
  const [{ data: user }, { data: rm }] = await Promise.all([
    sb.from("users").select("track,level,stack,hrs_per_day,deadline,days_per_week,session_min,style,xp,streak").eq("clerk_id", userKey).maybeSingle(),
    sb.from("roadmaps").select("id,title,goal,status,version,nodes,created_at").eq("user_id", userKey).eq("status", "ready").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return NextResponse.json({ user, roadmap: rm });
}

export async function PATCH(req: Request) {
  const userKey = await callerId(req);
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const sb = serviceClient();
  const map: Record<string, unknown> = {};
  if (parsed.data.goal !== undefined) map.goal = parsed.data.goal;
  if (parsed.data.hrsPerDay !== undefined) map.hrs_per_day = parsed.data.hrsPerDay;
  if (parsed.data.daysPerWeek !== undefined) map.days_per_week = parsed.data.daysPerWeek;
  if (parsed.data.sessionMin !== undefined) map.session_min = parsed.data.sessionMin;
  const { error } = await sb.from("users").upsert({ clerk_id: userKey, ...map }, { onConflict: "clerk_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
