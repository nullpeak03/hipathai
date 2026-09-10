import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type StoredNode = {
  order: number;
  phase?: string;
  phaseIndex?: number;
  type: "lesson" | "project";
  title: string;
  summary: string;
  difficulty: number;
  estMin: number;
  locked: boolean;
  status: string;
  weak: boolean;
  lesson?: Record<string, unknown> | null;
  quiz?: {
    questions: unknown[];
    attempts: number;
    lastScore: number | null;
  } | null;
  project?: {
    submissions: {
      kind: "github" | "paste";
      url?: string;
      scores: { correctness: number; structure: number; practice: number; readme: number; total: number };
      issues: string[];
      suggestions: string[];
      feedback: string;
      verified: boolean;
      pass: boolean;
      ts: string;
    }[];
    lastScore: number | null;
  } | null;
};

export type StoredRoadmap = {
  id: string;
  user_id: string;
  status: string;
  version: number;
  goal: string | null;
  title: string | null;
  draft: Record<string, unknown> | null;
  nodes: StoredNode[];
};

export type TutorThread = {
  id: string;
  user_id: string;
  roadmap_id: string | null;
  node_order: number | null;
  title: string | null;
  language: string | null;
  messages: { role: string; content: string }[];
  created_at: string;
  updated_at: string | null;
};

export function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function loadRoadmap(sb: SupabaseClient, id: string, userKey: string): Promise<StoredRoadmap | null> {
  const { data } = await sb
    .from("roadmaps")
    .select("id,user_id,status,version,goal,title,draft,nodes")
    .eq("id", id)
    .eq("user_id", userKey)
    .eq("status", "ready")
    .maybeSingle();
  return (data as StoredRoadmap | null) ?? null;
}

export async function saveNodes(sb: SupabaseClient, id: string, nodes: StoredNode[]) {
  const { error } = await sb.from("roadmaps").update({ nodes }).eq("id", id);
  if (error) throw new Error(`store_failed: ${error.message}`);
}

export async function logAi(
  sb: SupabaseClient,
  row: { user_id: string; task: string; provider: string; latency_ms: number; fallback_used: boolean; error_code?: string },
) {
  await sb.from("ai_logs").insert(row);
}
