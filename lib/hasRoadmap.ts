import { supabaseServer } from "@/lib/supabase/server";

// Single active roadmap rule (plan.md §2): newest `ready` roadmap wins.
export async function getActiveRoadmapId(clerkId: string): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const sb = await supabaseServer();
  const { data } = await sb
    .from("roadmaps")
    .select("id")
    .eq("user_id", clerkId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
