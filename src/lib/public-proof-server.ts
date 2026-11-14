import "server-only"
import { unstable_cache } from "next/cache"
import { createServerClient } from "@/lib/supabase/server"
import { buildProofMetrics, type ProofMetric } from "./public-proof"

export type PublicProof = { metrics: ProofMetric[] }

async function readLessonsGenerated(): Promise<number | null> {
  try {
    const supabase = createServerClient()
    // Count only lessons whose generation job succeeded. Lesson rows are
    // created with the roadmap outline and hold a placeholder heading +
    // objective in `content_md`; `content_json` is written only when a
    // lesson-generation job completes. Counting every row overstated the
    // public number by ~160x (2,668 rows vs 16 real lessons).
    const { count, error } = await supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .not("content_json", "is", null)
    if (error || typeof count !== "number") return null
    return count
  } catch {
    // Missing env or an unreachable database must never break a public page;
    // the strip simply omits usage numbers.
    return null
  }
}

/**
 * Cached public aggregates. Six hours keeps the number honest without
 * querying the database on every landing-page render.
 *
 * The key is versioned: Next's data cache persists across deployments on
 * Vercel, so changing the metric semantics without bumping the key keeps
 * serving the previous value until the TTL expires (observed: the old
 * 2,668 placeholder count survived the fix deploy).
 */
export const getPublicProof = unstable_cache(
  async (): Promise<PublicProof> => ({
    metrics: buildProofMetrics({ lessonsGenerated: await readLessonsGenerated() }),
  }),
  ["public-proof-v2"],
  { revalidate: 21_600 }
)
