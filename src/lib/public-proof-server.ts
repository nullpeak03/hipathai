import "server-only"
import { unstable_cache } from "next/cache"
import { createServerClient } from "@/lib/supabase/server"
import { buildProofMetrics, type ProofMetric } from "./public-proof"

export type PublicProof = { metrics: ProofMetric[] }

async function readLessonsGenerated(): Promise<number | null> {
  try {
    const supabase = createServerClient()
    const { count, error } = await supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
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
 */
export const getPublicProof = unstable_cache(
  async (): Promise<PublicProof> => ({
    metrics: buildProofMetrics({ lessonsGenerated: await readLessonsGenerated() }),
  }),
  ["public-proof"],
  { revalidate: 21_600 }
)
