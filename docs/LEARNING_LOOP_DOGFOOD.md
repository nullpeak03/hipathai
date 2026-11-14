# Learning loop — dogfood runbook

P1-1 of the 2026-11-13 audit: the learning loop is built but was never
validated in production (2 `progress` rows, 0 `review_schedule`, 0
`capstone_evidence`). Two of those gaps are now closed by code; this document
is the repeatable check for the rest.

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

## Known limits

- The SQL check cannot cover the route → function → UI path; steps 3–7 above
  are the only way to prove those.
- `review_schedule` is written by the submit route, not the SQL function, so
  step 3/4 are the production proof for that change.
- Account creation requires the Clerk dashboard or sign-up form; do not point
  this at a real learner's account.
