import { NextResponse } from "next/server";
import { z } from "zod";
import { callerId } from "@/lib/caller";
import { serviceClient } from "@/lib/store";

export const dynamic = "force-dynamic";

const Q = z.object({ order: z.coerce.number().int().min(0).optional() });

// Thread history for the tutor UI (persisted per lesson in tutor_threads).
export async function GET(req: Request) {
  const userKey = await callerId(req);
  const url = new URL(req.url);
  const q = Q.safeParse({ order: url.searchParams.get("order") ?? undefined });
  const order = q.success ? q.data.order : undefined;
  const sb = serviceClient();
  try {
    let query = sb
      .from("tutor_threads")
      .select("id,node_order,messages,created_at")
      .eq("user_id", userKey)
      .order("created_at", { ascending: false })
      .limit(20);
    if (order !== undefined) query = query.eq("node_order", order);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ threads: data ?? [] });
  } catch (e) {
    return NextResponse.json({ threads: [], error: e instanceof Error ? e.message : "failed" });
  }
}
