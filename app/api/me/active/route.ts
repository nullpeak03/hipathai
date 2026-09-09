import { NextResponse } from "next/server";
import { callerId } from "@/lib/caller";

export const dynamic = "force-dynamic";

// Guard helper for client pages (plan.md §2):
// session + 1 ready roadmap -> /app/dashboard instead of /onboarding,
// and resume-after-tab-close banner for still-generating roadmaps.
export async function GET(req: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ activeId: null, generatingId: null });
  }
  const userKey = await callerId(req);
  if (userKey.startsWith("anon:")) {
    return NextResponse.json({ activeId: null, generatingId: null });
  }
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data: ready } = await sb
    .from("roadmaps")
    .select("id")
    .eq("user_id", userKey)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: gen } = await sb
    .from("roadmaps")
    .select("id")
    .eq("user_id", userKey)
    .eq("status", "generating")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({
    activeId: (ready?.id as string) ?? null,
    generatingId: (gen?.id as string) ?? null,
  });
}
