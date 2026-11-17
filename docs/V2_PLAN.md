# HiPath AI — V2 plan (draft)

**Status:** proposal, 2026-11-16. V1 code work is closed (see the audit
close-out below); this document decides what V2 is *for*, not what to build
first. `docs/IMPLEMENTATION_PLAN.md` keeps the feature-level specs for V2.1
(capstone workspace) and V2.2 (skill readiness); this is the sequencing and
the bets around them.

## What V1 actually proved

- **Generation is production-grade.** Roadmap 39s, lesson 56s, model
  hedge/fallback, a shared deadline, and key-level failover. The failures that
  reached production in V1 were contract/UI bugs, not model failures.
- **The learning loop runs end to end.** Six real passes on one roadmap
  produced `progress`, `learner_mastery`, `review_schedule`, `quiz_attempts`,
  capstone evidence, and working AI feedback. Before this, those tables were
  empty.
- **The suite cannot see the product.** 592 tests passed while the capstone
  panel rendered raw chain-of-thought and every learner logged a 403 on every
  page load. Both were found by a human looking at production, not by a test.
- **Cost and latency are unmeasured per learner.** We know a job's wall time;
  we do not know tokens or dollars per activated learner, or how much of a
  lesson is reused across learners who share a topic.

## Keep / rewrite

**Keep.** Next.js app router + route handlers, Supabase Postgres with RPCs,
Clerk, Inngest, the NIM router, the mastery/review data model, capstone
evidence, and the readiness model. None of these are the bottleneck.

**Rewrite or retire.**

1. **Client data layer.** Roadmaps live in `localStorage` with manual
   `loadXAsync()` calls, and the sequential lock is computed in the lesson
   component from a cached array. That produces stale views, ambiguous "Lesson
   not found" states, and lock logic that differs from the server's
   `lessonIsUnlocked`. Move to server components or one typed query layer with
   explicit invalidation; keep the server as the only authority on unlocks.
2. **Capstone feedback as a one-shot prompt.** Today it is rendered, not
   stored, and costs one of three calls per day. V2.1 wants rubric-mapped,
   persisted assessments; build that as a record, not a toast.
3. **Per-learner lesson generation.** One roadmap already had 49 unique topics
   across 56 lessons. Generating each topic from scratch per learner is the
   main variable cost and a quality lottery. Generate a topic-level skeleton
   once, then personalize.

## Four bets, in order

Each bet ships behind a flag with one primary metric and a written kill
criterion. If the metric does not move in four weeks, stop and take the next
bet.

### 1. Make the retention loop real (weeks 1–2)

Reviews are scheduled but never exercised: the dogfood reviews have not come
due yet, and `/review` is an admin page, not a learner surface. Make due
reviews the default next action, show why a review is due, and record
completion.

- **Metric:** share of due reviews completed within 48h; week-2 return rate.
- **Kill:** if <15% of due reviews are completed after four weeks, the spaced
  model is not motivating anyone and should be replaced with weak-topic
  practice.

### 2. Know and halve the cost of a learner (weeks 3–4)

Record tokens, model, and wall time per feature and per lesson; reuse a
topic-level content skeleton across learners; keep the p95 lesson under 60s.

- **Metric:** dollars per activated learner (first passed lesson); p95 lesson
  generation time.
- **Kill:** if reuse drops quality scores or raises regeneration rates, keep
  per-learner generation and optimize the prompt instead.

### 3. Turn the capstone into portable proof (weeks 5–6)

Persist rubric-mapped capstone feedback per submission, connect it to V2.2
skill readiness, and export a one-page report. This is the only feature a
learner can show someone else.

- **Metric:** completed capstones per 10 activated learners; reports exported
  or shared.
- **Kill:** if fewer than 1 in 20 activated learners reaches a capstone,
  capstones are too far away; move the proof earlier (per-phase artifacts).

### 4. Distribution that matches the product (weeks 7–8)

Public roadmap pages are the main indexable surface, and the V1 CSP work
showed how easily prerendering and auth policy collide. Ship a curated
library plus prerendered topic pages, and measure sign-up → first pass.

- **Metric:** organic sign-ups; activation rate (sign-up → first passed
  lesson within 24h).
- **Kill:** if organic sign-ups stay under 10/week after four weeks, the
  library is not a channel and growth has to come from somewhere else.

## V1 lessons, encoded as rules

- **A green suite is not a shipped feature.** Every user-visible AI surface
  gets at least one assertion on rendered text (the capstone panel would have
  failed on "thinking process").
- **Budget checks belong in CI.** Recorded fixtures should assert token and
  latency ceilings, so a prompt change cannot quietly double cost.
- **Hypothesis before diagnosis.** The "stale cache" bug was a mistyped UUID;
  a 403 in the console was a real caller bug. Check the evidence, then name
  the cause.
- **State the failure scope.** Key failover covers key/quota exhaustion, not
  an NVIDIA-wide outage; `docs/AI_FAILOVER.md` says so, and V2 should not let
  that sentence rot.

## Non-goals for V2

- Multi-tenant teams (V3).
- Running learner code on the application server without a sandbox (V2.1
  depends on a separate preview environment).
- Billing, until activation and retention are measured. Keep the waitlist.

## Open decisions (owner: product)

1. Rewrite the client data layer before bet 1, or after it? (The client and
   server already disagree on how a lesson unlocks; that argues for before.)
2. Is the public library the growth channel, or a support surface for SEO?
3. Does V2 charge, or does it stay free until week-2 retention is known?

## V1 close-out reference

P0/P1/P2 audit items are closed except the vendor-wide AI outage, which is a
known, documented gap. `docs/NEXT_STEPS_PLAN.md` is the live status page for
what remains (reviews on 2026-11-19, token accounting, restore drill, apex CAA)
and `docs/DNS_EMAIL_POSTURE.md` records the DNS evidence.

The close-out commits, oldest first:

- `b00c3de` key-level AI failover (`NVIDIA_NIM_API_KEY_2`);
- `430353a` capstone feedback stops returning model reasoning;
- `af6a0de` stops every learner from probing the reviewer-only queue;
- `a757942` dogfood steps 5–6 evidence;
- `ee3f413` this plan;
- `cadd9a3` retired NIM models replaced; probe covers primaries and fallbacks;
- `f1c8cdc`, `48ea532` production lesson evidence and runbook corrections.
