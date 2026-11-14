import { inngest } from "./client"
import { createServerClient } from "@/lib/supabase/server"
import { roadmapGenerationTimeoutMs } from "@/lib/roadmap-sizing"
import { sendAdminAlert } from "@/lib/alerts"
import {
  evaluateJobHealth,
  summarizeJobs,
  JOB_HEALTH_WINDOW_MS,
  type JobRow,
} from "@/lib/job-health"

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
    // A stuck job is a user-visible failure; alert once per hour per scope.
    if (ids.length > 0) {
      await sendAdminAlert(
        "sweep-stale-jobs",
        `${ids.length} stuck generation job(s) marked failed`,
        ids.slice(0, 20).join("\n")
      )
    }
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

    // Health snapshot for the last hour: failure rate, p95 duration, and the
    // share of lessons that shipped without every section. Previously a
    // regression was only visible to whoever noticed the slow UI.
    let health: { total: number; failed: number; reasons: string[] } | null = null
    try {
      const since = new Date(now - JOB_HEALTH_WINDOW_MS).toISOString()
      const { data: recent } = await supabase
        .from("async_jobs")
        .select("id,status,started_at,completed_at,result")
        .gte("completed_at", since)
        .in("status", ["completed", "failed"])
      const summary = summarizeJobs((recent ?? []) as JobRow[])
      const reasons = evaluateJobHealth(summary)
      if (reasons.length > 0) {
        await sendAdminAlert("job-health", "Generation health degraded", reasons.join("\n"))
      }
      health = { total: summary.overall.total, failed: summary.overall.failed, reasons }
    } catch (e) {
      console.warn("[sweep] health check skipped:", e instanceof Error ? e.message : e)
    }

    return { swept: ids.length, purged, health }
  }
)
