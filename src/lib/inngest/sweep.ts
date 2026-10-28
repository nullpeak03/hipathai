import { inngest } from "./client"
import { createServerClient } from "@/lib/supabase/server"
import { roadmapGenerationTimeoutMs } from "@/lib/roadmap-sizing"

// Sweeps async_jobs stuck in `processing` whose run died without a terminal
// write (killed worker, retries exhausted, abandoned polls). It uses the
// planned phase count to avoid expiring long roadmaps prematurely.
export const sweepStaleJobsFn = inngest.createFunction(
  { id: "sweep-stale-jobs", triggers: [{ cron: "*/30 * * * *" }] },
  async () => {
    const supabase = createServerClient()
    const now = Date.now()
    const minimumTimeoutCutoff = new Date(now - 30 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from("async_jobs")
      .select("id,started_at,result")
      .eq("status", "processing")
      .not("started_at", "is", null)
      .lt("started_at", minimumTimeoutCutoff)
    const ids = ((data ?? []) as { id: string; started_at: string; result: { totalPhases?: unknown } | null }[])
      .filter((job) => {
        const totalPhases = Number(job.result?.totalPhases ?? 8)
        return now - new Date(job.started_at).getTime() > roadmapGenerationTimeoutMs(totalPhases)
      })
      .map((job) => job.id)
    for (const id of ids.slice(0, 100)) {
      await supabase.from("async_jobs").upsert({
        id,
        status: "failed",
        error: "Generation timed out on our side. Please try again.",
        completed_at: new Date().toISOString(),
      }, { onConflict: "id" })
    }
    console.log(`[sweep] marked ${ids.length} stale jobs failed`)
    // Purge expired rate-limit hits (older than any 1h window + margin) so
    // the table stays small. Best-effort: never fail the sweep over it.
    let purged = 0
    try {
      const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from("rate_limit_hits")
        .delete({ count: "exact" })
        .lt("ts", old)
      purged = count ?? 0
    } catch (e) {
      console.warn("[sweep] rate-limit purge skipped:", e instanceof Error ? e.message : e)
    }
    return { swept: ids.length, purged }
  }
)
