import { serviceClient } from "@/lib/store";

// Single active roadmap rule (plan.md §2): newest `ready` roadmap wins.
// NOTE: Uses service_role to bypass RLS (which blocks anon until Clerk JWT
// template is wired in M5). supabaseServer (anon) would always return null
// with current schema.sql (RLS enabled, no policies) — that broke dashboard
// guard and caused false redirects to /onboarding.
export async function getActiveRoadmapId(clerkId: string): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const sb = serviceClient();
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
