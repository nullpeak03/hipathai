# Learning loop — dogfood runbook

P1-1 of the 2026-11-13 audit: the learning loop is built but was never
validated in production (2 `progress` rows, 0 `review_schedule`, 0
`capstone_evidence`). Two of those gaps were closed by code, and the
2026-11-16 run below closed the data gaps; this document is the repeatable
check that keeps them closed.

## What is automated (no account, no mutation)

| Check | Command | Proves |
| --- | --- | --- |
| Grading + mastery + weak topics + progress | `psql "$DIRECT_URL" -f supabase/dogfood/learning-loop-check.sql` | The real `submit_quiz_assessment` function writes the loop's state on a real lesson, then rolls back. |
| Interval maths and first-pass scheduling | `npx vitest run src/lib/review.test.ts` | A first-time pass now gets a review (regression fixed in `nextReviewState`). |

Run both weekly. The SQL check ends in `ROLLBACK`; verify the counts are
unchanged if you want to be sure:

```sql
select
  (select count(*) from quiz_assessments) as assessments,
  (select count(*) from quiz_attempts)    as attempts,
  (select count(*) from progress)         as progress,
  (select count(*) from learner_mastery)  as mastery,
  (select count(*) from weak_topics)      as weak,
  (select count(*) from review_schedule)  as reviews;
```

## What still needs a signed-in session (30 min/week)

Use a dedicated dogfood account, never a real learner's. Sign in as it, then:

1. **Generate a roadmap** — `POST /api/roadmaps/async` via the wizard
   (goal "dogfood", 1 hr/day, 2 weeks). Expect `async_jobs.status='completed'`
   and `phases` + `lessons` rows for the new `roadmaps.id`.
2. **Complete 5 lessons** — open the roadmap, open each lesson, wait for
   structured content (`lessons.content_json is not null`), mark it read.
   Expect 5 `progress` rows.
3. **Take one quiz and pass it** — expect a `quiz_assessments` row with
   `submitted_at`, a `quiz_attempts` row, `progress.passed = true`,
   `learner_mastery` row, and — new since `nextReviewState` — a
   `review_schedule` row with `next_review_at = today + 3`.
4. **Take one quiz and fail it** — answer deliberately wrong. Expect
   `weak_topics.fail_count` to increase and `review_schedule.next_review_at`
   to become tomorrow.
5. **Check the reviews page** — `/api/me/reviews` lists the due lesson.
6. **Open the capstone** — submit evidence text. Expect a
   `capstone_evidence` row.
7. **Adapt the roadmap** — trigger replan once a weak topic has
   `fail_count >= 3`. Expect a replan proposal and, after accepting, updated
   phases.

### Assertions after the run

```sql
select
  (select count(*) from progress         where user_id = '<dogfood clerk id>') as progress_rows,
  (select count(*) from learner_mastery  where user_id = '<dogfood clerk id>') as mastery_rows,
  (select count(*) from review_schedule  where user_id = '<dogfood clerk id>') as review_rows,
  (select count(*) from weak_topics      where user_id = '<dogfood clerk id>') as weak_rows,
  (select count(*) from capstone_evidence where user_id = '<dogfood clerk id>') as evidence_rows;
```

Every count must be greater than zero. Anything zero identifies the stage
that is still not working.

## Verified in production — 2026-11-15

Run on the dogfood account with the deploy at `bf5cf4b`. Steps 1–4 and 7 pass.

| Step | Evidence |
| --- | --- |
| 1. Generate roadmap | job `387eaa82` → `completed`, `user_id` set, 4 phases / 28 lessons |
| 2. Lesson content | lesson `dfdd7b44` → 6000 chars / 35 blocks, `content_json` set, `remediation: none:complete`, `missingParts []` |
| 3. Pass a quiz | assessment `5f631d75` score 100 → `progress.passed`, `learner_mastery` 100, `review_schedule` interval 3 / next `+3d`, `quiz_attempts` 1 |
| 4. Fail a quiz | assessment `24c92070` score 0 → `weak_topics` fail_count 1, `review_schedule` interval 1 / next `+1d` / score 0; two more failures raised fail_count to 3 |
| 5. Reviews page | `/api/me/reviews` → `{"reviews":[]}`: nothing was due (reviews dated 11-16 and 11-18), so this step needs a second run on a due date |
| 6. Capstone | not run in this pass — see the 2026-11-16 run below |
| 7. Adapt roadmap | proposal `41d9850b` from the weak topic, approved → 1 practice lesson `a5bf596d` inserted, `generationQueued: true`, no failed job ids |

Telemetry from the same run (see `docs/LESSON_PIPELINE.md`):

- lesson job `ef2b6bb5`: wall 56.0s → `durationMs 56001`, `attemptMs 54414`
- roadmap job `4f8814b6`: wall 39.0s → `durationMs 39021`

Before the timestamp fix the same jobs reported `attemptMs 1624` (one step) and
`durationMs 3651` (one step), so the slow-job alert could never fire.

## Verified in production — 2026-11-16 (steps 5–6)

Second run, same dogfood account and roadmap `b7596773` (8 phases / 56
lessons, 49 unique topics). Lesson work on deploy `b00c3de`; the two fixes
found during the run are `430353a` and `af6a0de`.

| Step | Evidence |
| --- | --- |
| 2. Lesson content | lessons 2–6 generated through the UI ("Generate lesson"); lesson 1 already had `content_json` and an 8-question bank |
| 3. Pass a quiz (×6) | phase-1 lessons 1–6 scored 88 / 89 / 89 / 100 / 100 / 100. Resulting rows: 6 `progress` (`passed=true`, scores stored), 6 `learner_mastery`, 6 `review_schedule`, 6 `quiz_attempts`; 9 `quiz_assessments` were issued in total, 6 of them submitted |
| 5. Reviews page | still not due: every pass scheduled `next_review_at = today + 3`, so run this step on 2026-11-18 or later |
| 6. Capstone | evidence row `098d7646` — 292-char summary, repository + demo URLs, 3/3 rubric, 222-char reflection. `Get AI feedback` returned 1,990 chars with Strengths / Gaps / Next steps |

The step-6 assertions in one read:

```text
progress 6 · learner_mastery 6 · review_schedule 6 · weak_topics 1 ·
quiz_attempts 6 · capstone_evidence 1 · phase_exam_progress 0
```

`phase_exam_progress` is 0 because no phase exam was taken; it is not part of
steps 1–7.

### What the run taught us

- **The lock is sequential over the flattened roadmap, not per phase.** Phase-8
  lesson 1 needs all 49 earlier lessons passed; phase 1's capstone needs only
  its own six. Budget dogfood time from that, not from "phase 8 has 7 lessons".
- **The feedback panel was returning the model's reasoning.** The route called
  `callNim` without `thinkingDisabled`, so production rendered 2,745 characters
  starting "Here's a thinking process: 1. Analyze the User's Request…" and the
  real answer never fit in the 600-token cap. Fixed in `430353a` (7 route
  tests); the second call returned actual strengths/gaps/next steps.
- **Every learner logged a 403 on every page load.** The sidebar probed the
  reviewer-only `/api/me/review-queue` to decide whether to show `/review`.
  `af6a0de` moves that flag onto `/api/me/entitlement`; the queue keeps its
  403 for the `/review` page.
- **Direct navigation with an empty cache works.** A lesson URL opened after
  `localStorage.removeItem("hipath_roadmap")` loads through
  `/api/me/roadmap`. An earlier "Lesson not found" was a mistyped UUID in the
  URL, not a cache bug — check the id before suspecting the cache.

## Known limits

- The SQL check cannot cover the route → function → UI path; steps 3–7 above
  are the only way to prove those.
- `review_schedule` is written by the submit route, not the SQL function, so
  step 3/4 are the production proof for that change.
- Account creation requires the Clerk dashboard or sign-up form; do not point
  this at a real learner's account.
- Capstone feedback is rendered, not stored, and costs one of 3/day per user.
  Re-running step 6 means clicking the button again, not comparing rows.
