# Lesson generation pipeline

How an AI lesson is produced, how long each phase may take, and what to look at
when the sweep cron complains.

## Phases

| Phase | Step id | Budget | Notes |
|---|---|---|---|
| Mark processing | `mark-processing` | — | Keeps the job's original `started_at` across retries |
| Load context | `fetch-lesson` | — | Lesson + roadmap; re-checks ownership against the enqueuing user |
| Foundation part | `generate-lesson-part-1` | 100s | Runs first; establishes concepts and headings |
| Examples / context / practice | `generate-lesson-part-2..4` | 100s each, in parallel | Seeded with the foundation's headings |
| Draft publish | `publish-draft` | — | Only when remediation runs and the lesson has no readable content yet |
| Repair | `repair-lesson-<part>` | remaining budget, ≤100s | Missing essential parts, or a missing optional part on a weak lesson |
| Quality regeneration | `regenerate-lesson-weak-part` | remaining budget, ≤70s | Only when every part is present and the score is <70 |

A single attempt is capped at **240s** (`LESSON_ATTEMPT_BUDGET_MS`). The two
waves may consume 200s; remediation only starts when at least 55s remain and
never exceeds what is left. Before this, both remediation mechanisms could run
back to back and the user-visible chain reached ~6 minutes.

The budget is **per attempt**, not per job: an Inngest retry starts a fresh
invocation with a fresh budget. Starving a retry would turn a transient
provider blip into a failed lesson. The anchor is a memoized step
(`attempt-anchor-<n>`), because a local `Date.now()` only measures the current
step's invocation.

## Remediation policy (`src/lib/lesson-budget.ts`)

| Situation | Action |
|---|---|
| `foundation`, `examples` or `practice` missing | Repair those parts, regardless of score |
| Only `context` missing and score ≥85 | Leave it out — another 100s call is not worth it |
| Only `context` missing and score <85 | Repair it |
| Everything present, score <70 | Regenerate the weakest part |
| Everything present, score ≥70 | Nothing |
| Less than 55s of budget left | Nothing; ship what is complete |

One mechanism runs per attempt. A missing part is repaired; a complete-but-poor
lesson gets its weakest part redone. A second attempt only happens on an
Inngest retry.

## Partial content

When remediation is going to run, the merged content is saved as prose
(`content_md`) before the extra model call, and the job is marked
`processing` with `result.partial = true`. The status route forwards
`partial: true`, and the lesson page loads the content and shows a
"finishing" banner while polling continues.

`content_json` is **not** written until the job completes. This keeps the public
proof metric (`content_json is not null`) from crediting a half-finished
lesson, and leaves a failed regeneration's existing content untouched (the
draft is skipped whenever readable content is already present).

## Telemetry

Completed lesson jobs carry:

| Field | Meaning |
|---|---|
| `durationMs` | Route-created `started_at` → completion, includes retries |
| `attemptMs` | This attempt's wall clock, measured from the `attempt-anchor-<n>` step |
| `missingParts` | Parts still absent when content was saved |
| `remediation` | `repair:<parts>`, `regenerate:<part>`, or `none:<reason>` |
| `modelsUsed` | Distinct models that produced content |

Both durations come from durable timestamps, never from a timer captured in
the handler: Inngest runs every `step.run` in its own invocation, so a local
`Date.now()` measures a single step (a 70s roadmap job once reported 3.6s,
which kept the slow-roadmap alert from ever firing). `attempt-anchor-<n>` is a
memoized step whose id includes the attempt number — stable across the steps of
one attempt, re-executed when a retry starts.

`src/lib/job-health.ts` alerts through the 30-minute sweep when lesson p95
`durationMs` exceeds 15 minutes, when >20% of completed lessons are partial, or
when the failure rate exceeds 10%.

## Reading an alert

1. `remediation: none:out-of-time` on many jobs → the provider is slow; check
   per-part latency before raising the budget.
2. `missingParts` dominated by one part → look at that part's prompt/token cap
   in `LESSON_PARTS` / `partTokens`.
3. `durationMs` high but `attemptMs` low → retries, not slow model calls.
4. Partial rate high while failures are low → lessons ship without a section;
   confirm the affected part is not `practice` (that one gates exercises).
