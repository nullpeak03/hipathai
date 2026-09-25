import { inngest } from "./client"
import { createServerClient } from "@/lib/supabase/server"

// Sweeps async_jobs stuck in `processing` whose run died without a terminal
// write (killed worker, retries exhausted, abandoned polls). Runs every
// 30 minutes; only touches jobs older than 3 hours — even the largest
// roadmaps finish inside that window, so anything older is dead.
// (The status route's 30-min guard handles actively-watched jobs sooner.)
export const sweepStaleJobsFn = inngest.createFunction(
  { id: "sweep-stale-jobs", triggers: [{ cron: "*/30 * * * *" }] },
  async () => {
    const supabase = createServerClient()
    const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from("async_jobs")
      .select("id")
      .eq("status", "processing")
      .lt("started_at", cutoff)
    const ids = ((data ?? []) as { id: string }[]).map((r) => r.id)
    for (const id of ids.slice(0, 100)) {
      await supabase.from("async_jobs").upsert({
        id,
        status: "failed",
        error: "Generation timed out on our side. Please try again.",
        completed_at: new Date().toISOString(),
      }, { onConflict: "id" })
    }
    console.log(`[sweep] marked ${ids.length} stale jobs failed`)
    return { swept: ids.length }
  }
)
