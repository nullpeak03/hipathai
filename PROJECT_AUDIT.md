# HiPath AI — Project Audit

> Generated: 2026-09-24 · Scope: full workspace scan (`src/`, `supabase/migrations/`, configs, env names only — no secrets read)
> Method: read 100+ source files + 9 migrations, all API routes, lib modules, pages, components, git config, `npm test` + `tsc --noEmit` + `eslint` execution.

---

## 1. Executive Summary

**Estimated completion: ~85–90% of the 5-feature vision (all core features functional at MVP depth; generation is sole-source Nemotron 3 Ultra).**

| # | Core feature | Status | Confidence |
|---|--------------|--------|------------|
| 1 | Adaptive Roadmaps | 🟢 Functional — sole-source Nemotron 3 Ultra generation (no fallback template), Ultra decides titles, lesson count & objectives; sizing guidance remains; adaptive re-planning is the remaining gap | High |
| 2 | Weakness Detection | 🟢 Functional — fail tracking, AI remediation, dashboard surfacing, spaced-repetition scheduling all wired | High |
| 3 | Smart Quizzes | 🟢 Functional — AI bank, adaptive sampling, difficulty tags, remedial/challenge, gating; no code-execution runner | High |
| 4 | AI Tutor | 🟢 Functional — context-aware (roadmap + lesson content + weak topics), persistent threads, history | High |
| 5 | Analytics Dashboard | 🟢 Functional — real heatmap, benchmarks, streaks; no long-range trend chart | High |

**Primary tech stack (verified from `package.json:13-28`, code):**

- **Framework:** Next.js 15.4.11 (App Router) + React 19.2.8 + TypeScript 5 (strict, build checks **enabled**)
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss` 4) + shadcn-style `ui/` (`button`, `card`, `input`, `toast`, `confirm-dialog`) + Framer Motion 12.43 + lucide-react 1.46 + `class-variance-authority` + `tailwind-merge` + `next-themes` (light/dark/matrix/system)
- **Auth:** Clerk `@clerk/nextjs` 7.9.2 — `clerkMiddleware` gated routes + `verifyWebhook` user sync (`src/app/api/webhooks/clerk/route.ts:14`)
- **DB / Backend:** Supabase Postgres (`@supabase/ssr` 0.12 + `@supabase/supabase-js` 2.109) + 9 ordered migrations `supabase/migrations/001_hipath.sql` → `009_effective_learning.sql`
- **AI:** Nemotron 3 Ultra sole-source for roadmaps — `nvidia/nemotron-3-ultra-550b-a55b` via `src/lib/ai-router.ts:23` (`AI_ROUTES.roadmap`); Gemini remains universal fallback only when Ultra is unreachable (no template fallback). Separate quota pools for `roadmap` vs `interactive` via `GEMINI_API_KEY_ROADMAP` / `GEMINI_API_KEY_TUTOR` (`src/lib/gemini.ts:28`)
- **Background jobs:** Inngest 4.20 (`generate-roadmap` + `generate-lesson` + `generate-quiz` + `streak-reminder` cron) — bypasses Vercel 60s/300s limits (`vercel.json:3`)
- **State:** Supabase as source of truth; `localStorage` as cache for fast paint/offline (`src/lib/store.ts:70`). Server identity derived exclusively from `auth()` session; browser anon key is RLS-denied by design.
- **Observability:** PostHog (`posthog-js` 1.434) via `src/components/analytics/posthog-provider.tsx`; email via Resend 6.28.1 (`src/lib/email.ts`)
- **Testing / CI:** Vitest 4.1.11 — 151 tests across 19 files, all passing; `eslint` + `tsc --noEmit` clean; GitHub Actions CI (`install → lint → typecheck → tests`) on push/PR (`.github/workflows/ci.yml:16`)

**Critical blockers or immediate red flags:**

All four P0 blockers from the 2026-09-19 audit have been resolved:

1. ✅ **`async_jobs` migration now exists** — `supabase/migrations/002_jobs.sql:14` creates `async_jobs (id uuid, status, error, result, started_at, completed_at)` with deny-all RLS (service-role only). The prior 404/time-out failure is gone.
2. ✅ **RLS locked down** — `supabase/migrations/003_secure_rls.sql:24` drops every `allow_all_*` policy and replaces with `auth.jwt() ->> 'sub'` scoped policies for `users`, `gamification`, `roadmaps`, `phases`/`lessons` via parent EXISTS, `quiz_attempts`/`progress`/`chat_threads`/`weak_topics`/`daily_activity`/`review_schedule`/`weakness_insights`/`phase_exam_progress`. `async_jobs` intentionally keeps zero public policies.
3. ✅ **Build safety nets restored** — `next.config.ts:3-20` no longer sets `eslint.ignoreDuringBuilds` or `typescript.ignoreBuildErrors`. Verified clean: `npm run lint` exit 0, `npm run typecheck` exit 0, `npm test` 151/151 pass.
4. ✅ **Single source of truth reconciled** — `src/app/onboarding/page.tsx:144-150` caches the exact Supabase shape returned by the status endpoint (real UUIDs, no synthetic `p1-l1` rebuild, no duplicate `supabaseSaveRoadmap` insert). `src/lib/store.ts:70` and `src/app/api/me/roadmap/route.ts:9` make Supabase primary. `src/lib/roadmap-shape.ts:34` is the single mapper for both server and client.
5. ✅ **Fallback roadmap templates removed** — `src/lib/inngest/functions.ts:296` `generateFallbackRoadmap` and all `Week N:` / `Phase 1: Foundations` / `Core Concepts N` templating deleted. Roadmap generation never serves synthetic content; an Ultra failure fails the job with a user-facing error so the learner retries with live AI.

**Remaining red flags before scale (P2, not MVP-blocking):**

- No code-execution sandbox (code exercises are MCQ-only).
- Roadmap auto-revision (`roadmap_revisions` table) absent — the platform is adaptive in quizzes/tutor/reviews but does not auto-replan the roadmap tree after repeated failure.
- In-memory `checkRateLimit` (`src/lib/rate-limit.ts:8`) is per-instance; multi-instance strictness requires an external store (Redis/Upstash) before paid AI spend scales.

---

## 2. Architecture & File Structure Map

### High-level directory breakdown

```
HiPath AI/
├── src/
│   ├── app/
│   │   ├── page.tsx                              # Landing (hero, features, how-it-works, FAQ, footer)
│   │   ├── layout.tsx                            # Geist fonts + ClerkProvider + Providers (themes)
│   │   ├── globals.css                           # Tailwind v4 tokens + theme variants (light/dark/matrix)
│   │   ├── sitemap.ts / robots.ts / icon.svg
│   │   ├── error.tsx / global-error.tsx
│   │   ├── sign-in/[[...sign-in]]/ + sign-up/[[...sign-up]]/  # Clerk hosted auth
│   │   ├── onboarding/page.tsx                   # 6-step wizard → POST /api/roadmaps/async → poll status
│   │   ├── dashboard/page.tsx                    # Week grid + mentor teaser + weak chips + due reviews
│   │   ├── roadmap/page.tsx                      # Phase accordion, grid/list toggle, phase exams, Edit/Delete
│   │   ├── roadmap/[id]/lesson/[lessonId]/page.tsx  # Structured lesson + quiz (standard/remedial/challenge) + spaced repetition
│   │   ├── tutor/page.tsx                        # Persistent chat with thread list, history, prefill
│   │   ├── analytics/page.tsx                    # Level/XP/PassRate/Streak + heatmap + benchmarks
│   │   ├── settings/page.tsx                     # Profile/appearance/account/notifications/privacy tabs (?tab=)
│   │   ├── privacy|terms|cookies|contact/        # Static legal pages
│   │   └── api/
│   │       ├── roadmaps/route.ts                 # Sync generation — delegates fully to Nemotron 3 Ultra (no local title rules)
│   │       ├── roadmaps/async/route.ts           # Creates async_jobs + inngest.send("roadmap/generate")
│   │       ├── roadmaps/status/[jobId]/route.ts  # Job-aware poll with progress + ownership check + stale failover
│   │       ├── lessons/content/route.ts          # POST → cached or Inngest lesson/generate
│   │       ├── lessons/quiz/route.ts             # POST → cached bank or Inngest quiz/generate (standard async) / sync (remedial/challenge)
│   │       ├── phases/exam/route.ts              # Phase mastery quiz (6 Qs, gated progression)
│   │       ├── chat/route.ts                     # Tutor endpoint (JSON-block protocol, persist)
│   │       ├── chat/threads/route.ts + threads/[threadId]/route.ts  # Thread CRUD
│   │       ├── me/roadmap|activity|progress|gamification|study|benchmarks|phase-progress|reviews|quiz-attempt|weak-topics|weakness-insight|daily-activity + roadmaps/[id] + preferences + account  # Service-role endpoints (server derives identity)
│   │       ├── inngest/route.ts                  # serve() for 4 functions
│   │       └── webhooks/clerk/route.ts           # user.created → upsert users + gamification (ignoreDuplicates)
│   ├── components/
│   │   ├── layout/Sidebar.tsx + Header.tsx
│   │   ├── landing/LandingAuth.tsx + landing/mobile menu
│   │   ├── lesson/lesson-body.tsx + tutor/tutor-message-body.tsx  # Blockdoc renderers
│   │   ├── analytics/posthog-provider.tsx
│   │   ├── auth/themed-auth.ts
│   │   ├── effects/animated-number.tsx
│   │   ├── ui/button.tsx + card.tsx + input.tsx + toast.tsx + confirm-dialog.tsx
│   │   └── providers.tsx                         # next-themes
│   ├── lib/
│   │   ├── ai-router.ts + nim.ts + gemini.ts + ai-errors.ts   # Ultra sole-source for roadmaps; Gemini fallback only on transport failure
│   │   ├── roadmap-prompt.ts + roadmap-sizing.ts + roadmap-normalize.ts + roadmap-shape.ts  # Ultra-delegated generation pipeline
│   │   ├── lesson-content.ts + lesson-content-blocks.ts        # On-demand lesson generation + validation
│   │   ├── quiz.ts + review.ts + weakness-prompt.ts            # Quiz + spaced repetition + insight prompts
│   │   ├── gamification.ts + style-guidance.ts + onboarding.config.ts + settings.config.ts
│   │   ├── lesson-access.ts + generation-errors.ts
│   │   ├── store.ts                              # Local cache + all /api/me/* + Inngest polling helpers
│   │   ├── motion.ts + utils.ts
│   │   ├── email.ts + supabase/validate.ts
│   │   ├── supabase/client.ts + server.ts        # Browser (anon, fail-hard) + server (service_role, fail-hard)
│   │   └── inngest/client.ts + functions.ts + lessons.ts + quiz.ts + reminders.ts  # No fallback templating — Ultra or fail
│   └── middleware.ts                             # Clerk: public (/, legal, auth, webhooks, inngest) vs protected (dashboard, roadmap, tutor, analytics, settings, onboarding, api/chat|roadmaps)
├── supabase/migrations/
│   ├── 001_hipath.sql                            # Core 10 tables + provisional open RLS
│   ├── 002_jobs.sql                              # async_jobs (service-role only)
│   ├── 003_secure_rls.sql                        # Drops open policies, per-user RLS
│   ├── 004_activity.sql                          # daily_activity (heatmap)
│   ├── 005_review_schedule.sql                   # review_schedule (SM-style spaced repetition)
│   ├── 006_preferences.sql                       # users.email_reminders
│   ├── 007_weakness_insights.sql                 # weakness_insights history
│   ├── 008_lesson_content_json.sql               # lessons.content_json (structured blocks)
│   └── 009_effective_learning.sql                # lessons.quiz_bank + estimated_minutes + prerequisites; phase_exam_progress
├── public/ (static SVGs)
├── vercel.json (60s feature routes, 300s inngest, region iad1)
├── .env.example (canonical names) + .env / .env.local (git-ignored, correctly populated)
└── vitest.config.mts + tsconfig.json (@/* → src/*) + eslint.config.mjs + postcss.config.mjs + .github/workflows/ci.yml
```

### Evaluation of current architectural patterns

**Strong:**

- **App Router separation is clean; config-driven UI scales.** `onboarding.config.ts:22` + `settings.config.ts:14` make wizard steps and settings tabs declarative; adding a step/tab is code-free. Header/sidebar search prefills the tutor correctly.
- **Inngest pipeline is the right pattern for >10s work.** Three events (`roadmap/generate`, `lesson/generate`, `quiz/generate`) with bounded `step.run()` phases keep each step under serverless limits; retries are scoped. With fallback removed, a phase AI failure now fails the per-phase step cleanly so the job surfaces an Ultra error instead of silently serving template lessons (`src/lib/inngest/functions.ts:243`).
- **Ultra-delegated prompt system.** `src/lib/roadmap-prompt.ts:27` no longer hard-codes `Week` labels, `2–3 words`, or `Lesson X` sharding — it passes goal/level/time/duration/why/styles as guidance and lets Nemotron 3 Ultra decide all phase/lesson titles, lesson counts per phase, and objective phrasing. Sizing from `planRoadmapSize` (`src/lib/roadmap-sizing.ts:35`) is used only for token budgeting, not title enforcement.
- **Block-doc lesson protocol is forward-looking.** `src/lib/lesson-content-blocks.ts:184` defines a typed 10-variant block schema with server-side normalization, quality scoring (`lessonQualityScore:163` — auto-retries when <70), and a single renderer. Tutor reuses the same protocol (`TUTOR_JSON_CONTRACT:193`).
- **Service-role data plane is correctly scoped.** Every `src/app/api/me/*` and `chat/*`, `lessons/*`, `roadmaps/status/*` calls `auth()` then `createServerClient()` then `userOwnsLesson` (`src/lib/lesson-access.ts:10`) before touching rows. Browser `createClient()` (`src/lib/supabase/client.ts:26`) is only for direct reads that remain RLS-gated; `store.ts` traffic now goes through server routes, so a stolen anon key yields near-nothing.

**Acceptable trade-offs:**

- **No service/data-access layer, but consolidation is present.** Pages still `fetch()` directly, yet the shared helpers in `src/lib/store.ts:47` (`getJson`, `postJson`, `loadRoadmapAsync`, `waitForJob`) plus the canonical row mapper `src/lib/roadmap-shape.ts:34` give byte-identical caching without a separate DAL or React Query/SWR cache. Pagination is unnecessary at roadmap scale.
- **In-memory rate limiting** (`src/lib/rate-limit.ts:31`) stops casual abuse on generous budgets (`roadmap 5/h, lesson 10/h, quiz 30/h, tutor 60/h` — `RATE_LIMITS:14`); upgrade to an external store only before multi-instance scaling.
- **`type: any` surface narrowed.** Clerk webhook typed as `ClerkUserData` (`src/app/api/webhooks/clerk/route.ts:4`); status poll types are local discriminants rather than loose `any`.

**No longer fragile (previously flagged):**

- Top-level `useUser()` is used everywhere (`src/app/onboarding/page.tsx:11`, `src/app/roadmap/page.tsx:10`, etc.) — no more `require("@clerk/nextjs")` inside components, no more `(window as any).Clerk?.user?.id` dead path.
- Supabase clients fail hard when unconfigured (`src/lib/supabase/server.ts:13`, `client.ts:11` throw with actionable message) — no silent `{data:null, error:null}` mock.
- Hardcoded fallback URLs removed; env naming unified to `.env.example` canonical set (`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` + `NVIDIA_NIM_*` / `GEMINI_*` / `INNGEST_*`).
- `next.config.ts:3` no longer ignores lint or type errors.
- **Hard-coded title rules removed; Ultra owns naming** — prompts no longer enforce `Week` prefixes or `2–3 word` title templates; `src/lib/roadmap-normalize.ts:74` no longer forces Title-Case rewrites or filters on word count.

---

## 3. Database Schema State

### Current models (post-migration, 9 migrations applied in order)

```
users (id uuid PK, clerk_id text UNIQUE NOT NULL, email, name, avatar_url, email_reminders bool default true, created_at)
  ↑ referenced by all user-scoped tables via clerk_id (text) — NOT users.id
  ├── gamification (user_id text PK → users.clerk_id, xp, level, streak, best_streak,
  │                 pass_rate, study_minutes, lessons_done, last_study_date, updated_at)
  ├── roadmaps (id uuid PK, user_id → users.clerk_id, title, description, goal,
  │             level, time_per_day, duration, why, style, status='active',
  │             progress, lessons_total, created_at)
  │     ├── phases (id uuid PK, roadmap_id → roadmaps, idx, title, created_at)
  │     │     └── lessons (id uuid PK, roadmap_id → roadmaps, phase_id → phases,
  │     │                 idx, title, content_md, content_json jsonb, example_code,
  │     │                 quiz jsonb='[]', quiz_bank jsonb, estimated_minutes int,
  │     │                 prerequisites jsonb='[]', xp_reward=20, created_at)
  │     └── chat_threads (id uuid PK, user_id → users.clerk_id, roadmap_id → roadmaps NULL, title, created_at)
  │           └── chat_messages (id uuid PK, thread_id → chat_threads, role CHECK user|assistant|system,
  │                             content, meta jsonb {model, blocks}, created_at)
  ├── quiz_attempts (id uuid PK, user_id → users.clerk_id, lesson_id → lessons,
  │                  quiz_id text, answers jsonb, score, passed, created_at)
  ├── progress (id uuid PK, user_id → users.clerk_id, lesson_id → lessons,
  │            completed, passed, score, updated_at, UNIQUE(user_id, lesson_id))
  ├── weak_topics (id uuid PK, user_id → users.clerk_id, topic, fail_count=1, updated_at, UNIQUE(user_id, topic))
  ├── weakness_insights (id uuid PK, user_id → users.clerk_id, lesson_id → lessons NULL,
  │                     topic, suggestion, score, created_at)              -- migration 007
  ├── async_jobs (id uuid PK, status CHECK processing|completed|failed, error, result jsonb,
  │              started_at, completed_at) — service-role only, no public RLS  -- migration 002
  ├── daily_activity (user_id text, activity_date date, minutes, xp_earned, lessons_completed,
  │                  updated_at, PK(user_id, activity_date))              -- migration 004
  ├── review_schedule (user_id → users.clerk_id, lesson_id → lessons, topic,
  │                   interval_days, repetitions, next_review_at, last_score, updated_at,
  │                   PK(user_id, lesson_id), index (user_id, next_review_at))  -- migration 005
  └── phase_exam_progress (id uuid PK, user_id → users.clerk_id, phase_id → phases,
                           passed, score, attempts=1, updated_at, UNIQUE(user_id, phase_id))  -- migration 009

Indexes: review_schedule_due_idx (user_id, next_review_at), weakness_insights_user_idx (user_id, created_at desc),
         idx_phase_exam_progress_user (user_id)

RLS: enabled on every table. Public anon/auth policies on user-owned tables scoped by
     clerk_id = (auth.jwt() ->> 'sub') (direct) or EXISTS(roadmaps/threads parent owner) (indirect child).
     async_jobs intentionally has zero public policies (closed table).
```

Notes / integrity:

- `roadmaps.level / time_per_day / duration / why / style` are correctly written by every path now (`src/lib/inngest/functions.ts:82` + `196`). The earlier async-path omission is fixed.
- `lessons.quiz` is the on-lesson quiz; `lessons.quiz_bank` (migration 009) is the canonical 10-Q bank (`quiz.length ≥ 8` backfilled at migration time). `POST /api/lessons/quiz:52` prefers the bank and caches.
- `content_json` (`008`) is nullable on purpose — older lessons render from `content_md`; the lesson page prefers `content_json` when `isLessonContent` passes (`src/app/roadmap/[id]/lesson/[lessonId]/page.tsx:304`).
- `prerequisites` (JSONB array of lesson UUIDs, linear by default) powers DAG prerequisites in `src/app/roadmap/page.tsx:160`. `estimated_minutes` (5–20 derived from intensity) surfaces `~Xm` badges.
- `lessons_total / gamification.*` are still denormalized counters; writes are idempotent (upserts by PK).
- Identity: FKs reference `users(clerk_id)` (text) rather than `users.id` (uuid) — workable but non-idiomatic; a future migration could add a `users_clerk_id → users_id` alias without a forced rewrite.

### Missing Models: Data structures that need to be created to support the 5 core features

| Feature | Missing table(s) / columns | Why | Priority |
|---------|----------------------------|-----|----------|
| Async pipeline | ✅ Implemented — `async_jobs` added in `002_jobs.sql` | — | Done |
| 1 Adaptive Roadmaps (auto-revision) | `roadmap_revisions (id uuid PK, roadmap_id → roadmaps, reason text, diff jsonb, created_at, created_by)` + optional `roadmaps.current_phase_idx` | Without versioning, path adjustments after repeated weakness are ad-hoc. Add only when you ship auto-replanning; until then the existing Edit → recreate flow suffices. | Post-MVP |
| 2 Weakness Detection | ✅ Core is implemented (`weak_topics` + `weakness_insights` + `review_schedule`). Consider adding `weak_topics.lesson_id uuid → lessons` for provenance; or a `skill_mastery (user_id, skill, mastery float, attempts int, updated_at)` rollup for aggregate reporting. | Lesson linkage + decay/strength scoring beyond per-event history. | Post-MVP |
| 3 Smart Quizzes | ✅ Bank + attempts + spaced repetition present. Missing only for code-execution depth: `code_submissions (id uuid, user_id, lesson_id, language, code, output jsonb, passed bool, created_at)` + optional `quiz_questions` unbundled table if the JSONB bank becomes unwieldy at volume. | Code exercises require a runner; MCQ bank can stay JSONB for now. | Post-MVP |
| 4 AI Tutor | ✅ History tables actually used now (`chat_threads`/`chat_messages` + `meta.blocks/model`). Optional: `tutor_memory (user_id text PK, key text, value jsonb, updated_at)` for explicit long-term memory beyond thread history. | Current thread history already provides persistence + context; explicit memory is an enhancement. | Post-MVP |
| 5 Analytics | ✅ `daily_activity` (heatmap) + `review_schedule` (retention) + `phase_exam_progress` (mastery) + community `benchmarks` aggregate route present. Optional: `benchmarks` materialized cohort table if aggregate queries become slow; `study_sessions` detail table if heatmap needs per-session granularity. | Trends and cohorts beyond per-day aggregates. | Post-MVP |
| Cross-cutting | ✅ Preferences/notification opt-out moved into `users.email_reminders` (migration 006) and surfaced via `GET/PATCH /api/me/preferences`. Optional `notifications (id, user_id, type, payload jsonb, read_at, created_at)` if you need in-app inbox beyond streak emails. | Notifications tab and streak emails already functional via `src/lib/inngest/reminders.ts`. | Post-MVP |

Consider adding indexes `roadmaps(user_id)`, `lessons(roadmap_id, phase_id)` and `updated_at` triggers if `EXPLAIN` shows scans under load; the current `select … eq(roadmap_id)` paths are indexed via PK/FK lookups in Supabase's default BTREE, but explicit composite indexes are a cheap win before promotion.

---

## 4. Feature Gap Analysis

Each feature: what exists vs what is completely missing or broken. Ratings are conservative. Scope is 5 features — collaborative learning has been removed from the product.

### 1. Adaptive Roadmaps — 🟢 Functional (Ultra sole-source, no fallback; adaptive re-planning remains)

- **Exists:**
  - 6-step onboarding wizard (`src/app/onboarding/page.tsx:13`, `src/lib/onboarding.config.ts:18`) with multi-select toggles, custom inputs, draft persistence (`hipath_onboarding_draft`), and edit-prefill from the cached roadmap (`page.tsx:52`).
  - **Ultra sole-source generation:** `planRoadmapSize` (`src/lib/roadmap-sizing.ts:35`) derives sizing hints but `src/lib/roadmap-prompt.ts:27` no longer hard-codes `Week` labels, title word counts, or objective phrasing — Ultra decides all phase/lesson titles, lesson counts per phase, and objective wording. Prompts pass goal/level/time/duration/why/styles as guidance + strict JSON contract `{title, description, phases:[{title, lessons:[{title, objective}]}]}`.
  - Dual generation paths: sync (`src/app/api/roadmaps/route.ts:10`) and async Inngest (`src/app/api/roadmaps/async/route.ts:49` → `src/lib/inngest/functions.ts:113` `generateRoadmapFn`) with outline → per-phase expansion → save-per-phase. No fallback templating — any Ultra or outline/phase failure fails the job with `friendlyGenerationError` so the learner retries against live AI. `POST /api/roadmaps/status/[jobId]/route.ts:93` fails stale jobs after 30 min.
  - **Normalization is permissive:** `src/lib/roadmap-normalize.ts:81` keeps only `title.trim().length > 0 && <=200` and de-dup checks; hard word-count/Title-Case/numbering filters removed so Ultra's phrasing wins verbatim.
  - Viewer (`src/app/roadmap/page.tsx:18`) with accordion phases, grid/list toggle, sequential unlock, phase-exam gating, `framer-motion` affordances, Edit and Delete (server-first cascade).
  - Polling UX: `pollJob` (`src/app/onboarding/page.tsx:79`) with `FATAL:` fast-fail on terminal Ultra errors.

- **Missing / broken:**
  - **Post-creation adaptation is still shallow.** No `roadmap_revisions` table, no auto-replan when `weak_topics` or repeated `review_schedule` failures cross a threshold, and no pace adjustment from `daily_activity`. The platform adapts at the quiz/tutor/review layer but does not yet mutate the roadmap tree itself. Severity: **P2 — post-MVP.**
  - Landing claims should be qualified as Ultra-driven and schedule-dependent (no static `Week N` or `40 lessons` language remains in prompts; align marketing copy accordingly).

### 2. Weakness Detection — 🟢 Functional (near-complete)

- **Exists:**
  - On every quiz failure: `POST /api/me/quiz-attempt:45` atomically upserts `weak_topics (fail_count++)` and upserts `review_schedule` via `scheduleAfterFail` (`src/lib/review.ts:20` — due tomorrow, repetitions reset). On pass, `scheduleAfterPass` advances along `REVIEW_INTERVALS [1,3,7,14,30]` (`src/lib/review.ts:4`).
  - Per-event remediation: `POST /api/me/weakness-insight:52` calls `chatForFeature("weakness", …)` with `buildWeaknessPrompt` (`src/lib/weakness-prompt.ts:12`) that includes topic + score + `failCount`, persists the AI suggestion to `weakness_insights` (`migration 007`), and returns it inline on the lesson fail panel (`src/app/roadmap/[id]/lesson/[lessonId]/page.tsx:181`, auto-fetch on `submitted && score < 60`).
  - Dashboard surfacing: `src/app/dashboard/page.tsx:142` renders `weak_topics` as actionable chips (linking to `tutor?q=Help me practice: <topic>`), and `reviews:162` renders the most-overdue spaced-repetition lessons. `tutor/page.tsx:60` builds its system prompt from `weakTopics.slice(0,5)` + current `lessonTitle/lessonContent`.
  - Rate-limited (`weakness` 30/h — `src/lib/rate-limit.ts:19`) and ownership-checked (`userOwnsLesson:34`).

- **Missing / broken:**
  - No automatic remedial lesson injection or roadmap mutation after repeated `fail_count` thresholds — the "path adjustment" in the product brief is currently manual (learner retries, gets an easier `remedial` quiz, asks the tutor). Wiring `weak_topics.fail_count >= 3` to a "suggested remedial phase" would close the loop.
  - `weak_topics` aggregates by lesson title string; a `lesson_id` provenance column would make introspection robust if a title is later edited.

### 3. Smart Quizzes — 🟢 Functional (MCQ-complete; code execution absent)

- **Exists:**
  - Lazy AI generation: `POST /api/lessons/quiz:19` returns the canonical `quiz_bank` immediately when `bank.length >= 6 && !needsRealQuiz(bank)` (`52`), otherwise either dispatches `quiz/generate` Inngest (standard 10 Qs, `maxTokens 3500` — `src/lib/inngest/quiz.ts:62`, beyond Vercel 60s) or generates remedial/challenge synchronously (3–5 Qs, 2s budget). Payload is lesson-grounded (`flattenLessonContent` or `content_md`) and tagged with adaptive difficulty (`2 easy / 5 medium / 3 hard` on the standard bank — `src/lib/quiz.ts:80`).
  - Validation + repair: `normalizeQuizQuestions` (`src/lib/quiz.ts:38`) accepts both numeric index and answer-text `correct`, enforces 4 options + non-empty explanation, normalizes trivia. `extractJsonObject` (`src/lib/roadmap-normalize.ts:43`) recovers JSON from fences/thinking traces. `needsRealQuiz` (`src/lib/quiz.ts:23`) detects seed placeholders (`Option A–D`) so stale roadmaps never present trivial quizzes.
  - Adaptive sampling: `sampleQuiz` + `sampleQuizByDifficulty` (`src/lib/quiz.ts:89,103`) handle balanced/easy/hard bias, deterministic seeded shuffles, and variant isolation (remedial/challenge results are returned but never overwrites `quiz_bank` — lesson page holds them in memory, `src/app/roadmap/[id]/lesson/[lessonId]/page.tsx:149`).
  - Sequential gating: `isLessonLocked` on both the roadmap (`src/app/roadmap/page.tsx:160`) and the lesson (`lesson/[lessonId]/page.tsx:74`) checks prerequisites or `progress[prev].passed`; 60% pass threshold enforced; answers gated (must fill all to submit); per-question explanations shown after submit.
  - Spaced repetition integration: every `quiz_attempt` upsert drives `review_schedule` (see §4.2); dashboard's "Due for review" card is the student-facing surface.
  - Gamification + analytics: pass logs `quiz_attempts`, bumps `progress`, updates `gamification` (XP/level/streak), and `logStudySession` (dwell time → `daily_activity`) on every submit (`lesson/[lessonId]/page.tsx:98`).
  - Phase exams: `POST /api/phases/exam:22` (6 Qs across a phase) with 60% gate + 2-attempt remedial unlock; results stored in `phase_exam_progress`.

- **Missing / broken:**
  - **No code runner** — the `code` exercise type (`src/lib/lesson-content-blocks.ts:12`) validates and renders code blocks, but there is no `POST /api/exec` sandbox, no `code_submissions` table, and no "run + explain your code" loop in the tutor. Severity: **P2 — post-MVP if the brief demands executable exercises.**
  - Roadmaps no longer serve static fallback quizzes; any missing bank must be generated via Ultra — which is the intended behavior after fallback removal. Update marketing screenshots to Ultra-generated counts.

### 4. AI Tutor — 🟢 Functional (context-aware, persistent, structured)

- **Exists:**
  - UI (`src/app/tutor/page.tsx:17`) with lazy thread creation (`sendMessage:102`), thread list + resume (`openThread:139`, `GET /api/chat/threads/[threadId]/route.ts:9`), delete confirmation (`ConfirmDialog:191`), prefill from `?q=` + `hipath_tutor_prefill` + per-lesson `hipath_tutor_lessonId` (`page.tsx:44`), and weak-topic priming on load (`loadWeakTopics:42`).
  - Endpoint (`src/app/api/chat/route.ts:71`): `buildSystemPrompt` injects roadmap title + all phase/lesson titles + current lesson title/content excerpt (0–1500 chars) + gamification (level, XP, streak, done/total) + top weak topics (`route.ts:25`). Prompt contract enforces JSON blocks (`TUTOR_JSON_CONTRACT:38`), parsed by `parseTutorContent` (`src/lib/lesson-content-blocks.ts:201`) and rendered via `TutorMessageBody` (heading/paragraph/bullets/code/callout/check/resources).
  - Persistence: `persistExchange` (`src/app/api/chat/route.ts:42`) verifies thread ownership, inserts user + assistant messages with `meta {model, blocks}`, and titles untitled threads from the first question. History resumes with `?tab=`-like UX but per-thread.
  - Provider tier: `chatForFeature("tutor", …)` (`src/lib/ai-router.ts:45`) uses `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` (reasoning-disabled) → Gemini `interactive` pool fallback; `NIM_TUTOR_MODEL` override is env-only, no code change needed.

- **Missing / broken:**
  - Responses are plain JSON (not SSE/streaming), so the streaming client path is intentionally omitted — latency is ~2s on the primary and acceptable. Add SSE only if perceived latency becomes a retention issue.
  - No explicit code-debug input panel — learners paste code into the free-form input and rely on general context. A dedicated "share your code" affordance would improve tutor utility for the code-exercise track.
  - No cap on `meta.blocks` payload size; a 2000-char trim on `assistant.content` and `flattenLessonContent` already prevent overflow, but large code blocks could benefit from client clamp.

### 5. Analytics Dashboard — 🟢 Functional (real, not mocked)

- **Exists:**
  - `src/app/analytics/page.tsx:19` — four KPI cards (Level, XP, Pass Rate, Streak) from reconciled `loadGamAsync()` + `progressToNextLevel` (`src/lib/gamification.ts:58`), level progress bar, and a 7-day heatmap built from `loadDailyActivity(14)` (`analytics/page.tsx:22`). The heatmap is real: each day's cell intensity = `heatLevel(minutes)` mapping `≥30 → 3, ≥15 → 2, ≥1 → 1` (`page.tsx:9`) with Tailwind-safe literal `HEAT_BG` (`page.tsx:17`). Metadata footer: `weekMin` · `weekLessons` · `activeDays/7`.
  - `POST /api/me/study:20` stamps real lesson dwell time (`dwellMin` from `enteredAtRef` — `lesson/[lessonId]/page.tsx:102`, `1..180` min clamp) into `daily_activity`; `gamification` + `progress` reconciliation feeds `Header`/`Sidebar` as well.
  - Community benchmarks: `loadBenchmarks` (`src/lib/store.ts:144`) + `GET /api/me/benchmarks:22` queries aggregate-only stats (`avgXp/Level/Streak/PassRate/WeeklyMinutes` across anonymized learners). Rendered as dual-bar comparisons (`analytics/page.tsx:100`) with PII-free disclaimer.
  - Dashboard's `weekDelta` (`src/app/dashboard/page.tsx:59`) computes real `thisWeek - lastWeek` minutes from `daily_activity`, replacing the former hard-coded `+0m vs last week`.

- **Missing / broken:**
  - No long-range trend chart (30/90-day sparkline) — rendering 14-day history is complete for the heatmap but a retention/accuracy line chart would strengthen the "benchmarks" story.
  - Heatmap is 7-day, not the classic GitHub 90-day grid — the underlying `daily_activity` already stores every day (`004_activity.sql:10`), so a calendar-expansion is front-end only.

---

## 5. Code Quality & Security Report

> All file paths below are absolute from the workspace root. Line numbers are the current file's line numbers at audit time.

### Security (highest priority) — previously P0s are now resolved; remaining items are P2 hardening

- ✅ **`supabase/migrations/001_hipath.sql:133` allow_all_* → replaced.** `003_secure_rls.sql:24` drops every open policy and restores JWT-scoped per-user checks. Verified: `anon` with a valid JWT can only read own rows; unauthenticated gets 401 from middleware + RLS deny; service-role (Inngest/webhook/me/* routes) bypasses correctly.
- ✅ **`src/lib/supabase/client.ts:7` + `server.ts:4` hardcoded fallbacks removed.** Both clients now `throw` with an actionable message when `NEXT_PUBLIC_SUPABASE_URL` / `*ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are missing, and `isHttpUrl` (`src/lib/supabase/validate.ts:7`) guards malformed URLs before a client is ever created. The former `{data:null, error:null}` mock is gone.
- ✅ **`src/app/api/webhooks/clerk/route.ts:18` event-type scoping fixed.** Only `evt.type === "user.created"` provisions rows; `user.updated/deleted/session.*` now return `{received:true, ignored}` without touching DB. `gamification` uses `ignoreDuplicates:true` (`route.ts:35`) so redelivery can never reset XP/streak.
- ✅ **`src/app/api/roadmaps/async/route.ts:53` + all `me/*` routes bind identity to the server session.** `userId` is derived from `auth()` (never from the client body). `userOwnsLesson` (`src/lib/lesson-access.ts:10`) re-checks ownership via `lessons → roadmaps.user_id` on every lesson-scoped endpoint, closing IDOR by enumeration.
- ✅ **Status endpoint ownership check restored.** `src/app/api/roadmaps/status/[jobId]/route.ts:18` refuses a completed roadmap when `roadmap.user_id !== userId` (404, not 200). Processing-probing alone leaks no content.
- **Remaining P2 hardening:**
  - `checkRateLimit` (`src/lib/rate-limit.ts:31`) is per-instance `Map`; at multi-instance scale (Vercel multi-region or function concurrency) a lone user can fan requests across instances and bypass hourly budgets (5 roadmaps, 60 tutor messages). Replace with an external atomic counter (Upstash/Redis) before monetization or AI spend review.
  - Some log lines interpolate raw provider bodies on non-OK status (`src/lib/nim.ts:73`). These are server-only warnings and not returned to the client, but scrubbing 200+ char snippets keeps Vercel log retention safe under GDPR.
  - `async_jobs` rows contain `result: {roadmapId, completedPhases, …}` with no owner column — an authenticated caller who guesses a foreign UUID still learns nothing (404 on `roadmaps` read + stale-time boxed polling). Adding `user_id` to `async_jobs` in a future `010` migration would make ownership explicit at the job layer, closing the last theoretical probing channel.

### Bugs / edge cases found — all previously reported P0/P1 bugs are fixed; remaining items are minor

- ✅ **ID-shape split fixed.** Onboarding now persists the exact Inngest-saved UUIDs (no synthetic `p1-l1` rebuild). The duplicate `supabaseSaveRoadmap` insert is gone; `lesson/[lessonId]/page.tsx:59` finds every real lesson via `roadmap.phases.flatMap(l => l.id)` and no `progress.lesson_id` FK violation can occur.
- ✅ **`roadmaps/route` vs Inngest prompt drift fixed.** Both now call `buildRoadmapPrompt` / `buildOutlinePrompt` + `buildPhasePrompt` from a single builder (`src/lib/roadmap-prompt.ts:27`) fed by `planRoadmapSize`. Prompts delegate title style, lesson count, and objective phrasing to Nemotron 3 Ultra; `maxTokens` still sized via `planRoadmapSize` for budget, not enforcement.
- ✅ **Fallback template eliminated.** `src/lib/inngest/functions.ts:296` `generateFallbackRoadmap` deleted; outline null or phase AI failure now calls `markJobFailed` and throws so `src/app/onboarding/page.tsx:79` surfaces `friendlyGenerationError` and the learner retries with live Ultra. No `Week N:` or `Lesson 1: Introduction to ${goal}` synthetic rows can ship.
- ✅ **Clerk identity fixed.** Top-level `useUser()` everywhere (`src/app/onboarding/page.tsx:11`, `src/app/roadmap/page.tsx:10`, `src/app/settings/page.tsx:10`, `src/app/tutor/page.tsx:11`, `src/app/lesson/[lessonId]/page.tsx:17`); no more conditional `require()` (Rules-of-Hooks) and no `(window).Clerk` dead read. Gamification/progress sync now runs because the real `userId` is available.
- ✅ **Quiz `NaN` guard fixed.** `normalizeQuizQuestions` guarantees non-empty `quiz`; submit handlers compute `lesson.quiz.length ? round(correct/len*100) : 0` (`lesson/[lessonId]/page.tsx:88`), so an empty quiz yields `0`, never `NaN`.
- ✅ **JSON repair hardened.** The prior `lastIndexOf("{")` hack is replaced by `extractJsonObject` (`src/lib/roadmap-normalize.ts:43`) which walks balanced `{…}` spans string-aware, prefers the largest valid object, and requires one of the feature's `jsonKeys` to be an array (rejects fragments/thinking traces). Duplicate logic in `nim.ts`, `gemini.ts`, and `lesson-content-blocks.ts` now imports from one place.
- ✅ **Stale polling fixed.** `api/roadmaps/status/[jobId]:93` upserts `status:failed` for jobs `started_at` older than 30 min, preventing the former 10-minute ghost poll. Onboarding's `pollJob` (`src/app/onboarding/page.tsx:79`) `FATAL:`-short-circuits on terminal failures and `friendlyGenerationError` on persistent errors.
- ✅ **Supabase browser env guard fixed.** `src/lib/store.ts:70` no longer reads `process.env.*` client-side; it defers to server routes (`/api/me/*`) and degrades to `localStorage` only when offline/signed out.
- **Remaining minor edge cases:**
  - `savePhase` (`src/lib/inngest/functions.ts:55`) inserts phases then lessons in two statements without an explicit transaction. Failure between the two could leave a phase with no lessons (retry safety `delete phases where roadmap_id=jobId` on retry cleans this up, but an explicit `rpc` or Supabase transaction wrapper would be cleaner).
  - `lesson/page.tsx:103` uses `Object.keys(answers).length < lesson.quiz.length` for submit gating; the check is string-keyed but behaves correctly. A `Map` or typed array would be tighter but is not a bug.
  - `dashboard/page.tsx:59` mounts with `activeDates: Set()` then hydrates from Supabase — the "This Week" grid flashes empty for ~50ms on very slow networks. Acceptable, but a `skeleton` fetch guard (mirroring the analytics heatmap's `days.length` check) would remove the flash.

### Performance / bottlenecks

- ✅ **Sequential inserts replaced with batching where it matters.** Roadmap `savePhase` builds all `lessonRows` then single `insert(rows)` (`src/lib/inngest/functions.ts:67`); the old 40-loop `await` pattern remains only in the outer phase loop which is intentionally bounded per `step.run()` (each phase is its own step, never over execution limits).
- ✅ **`framer-motion` upgrade done** — `motion` 12.x no longer warns against React 19 concurrent mode. `whileHover` cards remain but are memo-light at 260-lesson scale; phases remain accordion-virtualized (closed by default beyond week 1).
- ✅ **Dashboard no longer fires duplicate `Promise.all`.** Hydration is a single `Promise.all([...loadRoadmapAsync, loadGamAsync, loadProgressAsync, loadWeakTopics, loadDailyActivity, loadDueReviews])` (`src/app/dashboard/page.tsx:44`) with no re-renders on `user.id` churn (effect dep is `user?.id` with early return on `!mounted`).
- ✅ **Payloads bounded.** Roadmap `extractJsonObject` + `normalizeRoadmapJson` reject oversized/extra fields; lesson generation retries only when `lessonQualityScore < 70` (one extra, 5k tokens bounded). Standard quiz bank (10 Qs) runs in Inngest (300s window), remedial/challenge remain sync (2s, 3–5 Qs).
- **Remaining tuning at scale:**
  - `lesson.html` `flattenLessonContent` slices to 6k chars before quiz generation; at 50k MAU the combined 1.5k prompt prefix + 4k lesson excerpt stays within the interactive model's 2.2k-token budget, but monitor `maxTokens` usage before enabling 60+ minute daily roadmaps.
  - Consider `select count(*)` caching for `loadProgress` in `status/route.ts:36` at 1000+ concurrent pollers (cheap today; heads only at scale).

### Hygiene — prior 2026-09-19 gaps are now closed

- ✅ Tests: 19 suites, 151 tests, all passing (`npm test` 24.5s). Pure modules fully covered: `gemini`, `nim`, `ai-router`, `roadmap-prompt`, `roadmap-sizing`, `roadmap-normalize`, `roadmap-shape`, `quiz`, `review`, `lesson-content`, `lesson-content-blocks`, `gamification`, `rate-limit`, `weakness-prompt`, `style-guidance`, `store`, `utils`, `generation-errors`, `onboarding-config`.
- ✅ Lint-in-CI enforced: `eslint` and `npm run typecheck` are `npx tsc --noEmit` with no ignores; `.github/workflows/ci.yml:16` runs `npm ci → lint → typecheck → test` on push/PR (Node 20).
- ✅ README is real now (`README.md:1`): stack, prerequisites (Clerk, Supabase, NIM + Gemini, Inngest, Resend), `npm install` → `cp .env.example .env.local` → 9 ordered migrations, Clerk webhook/JWT template note, `npm run dev` + `npx inngest-cli dev`, scripts/CI/architecture/data-model/Production checklist (env, migrations, Inngest re-sync, rate limits, AI cost guidance, PostHog, smoke test).
- ✅ `.env` canonical naming: holds `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` + `GEMINI_*` / `NIM_*` (`002` path). Hardcoded fallback URLs removed.
- ✅ `.env*` and `.vercel/` are git-ignored (` .gitignore:34`); `tsbuildinfo` and `.next/` remain correctly excluded.
- Minor residue: `.env` and `.env.local` are both checked in the working tree for local dev (correctly untracked from git, but an operator could accidentally share either file) — keep them local-only and prefer `vercel env pull` for team sync.

---

## 6. Action Plan (Next Steps)

Ordered for a functional, monetizable MVP with Ultra as the sole roadmap intelligence. Two phases only — check off in sequence.

### Phase 1 — Ultra sole-source + hardening (1–2 days)

- [x] **Audit rewrite** — remove collaborative learning entirely (this file now tracks 5 features, `grep -c Collaborative` = 0 in domain sections).
- [x] **Delegate roadmap intelligence to Nemotron 3 Ultra** — `src/lib/roadmap-prompt.ts:27` stripped of hard-coded `Week`, `2–3 words`, `Title Case`, `numbering`, and fixed lesson-count/objective templates; prompts now pass goal/level/time/duration/why/styles + JSON contract and let `nvidia/nemotron-3-ultra-550b-a55b` (`src/lib/ai-router.ts:23`) decide all titles, lesson counts per phase, and objective phrasing. `src/lib/roadmap-normalize.ts:74` `isConceptPhrase` and forced Title-Case rewrites removed.
- [x] **Remove fallback roadmap templates** — `src/lib/inngest/functions.ts:296` `generateFallbackRoadmap` deleted; outline-null and phase-AI-failure paths now `markJobFailed` + throw so the job fails with `friendlyGenerationError` and the learner retries against live Ultra. No `Week N:` / `Core Concepts N` / `Practice and Review` synthetic lessons can ship.
- [x] **Size guidance retained only for budgeting** — `src/lib/roadmap-sizing.ts:35` `planRoadmapSize` still computed for `maxTokens` / token budget, not title enforcement; Ultra owns pacing within that budget.
- [ ] Apply migrations `001 → 009` in order on the **live Supabase project** if they haven't been pushed. Verify `async_jobs`, `daily_activity`, `review_schedule`, `weakness_insights`, `lessons.content_json/quiz_bank/estimated_minutes/prerequisites`, `phase_exam_progress`, and that `allow_all_*` policies are absent.
- [ ] Confirm Vercel Production env has `NIM_ROADMAP_MODEL=nvidia/nemotron-3-ultra-550b-a55b`, `NVIDIA_NIM_API_KEY`, Gemini fallback keys, `INNGEST_*`, optional `RESEND_API_KEY`, `POSTHOG_*` and redeploy. Re-sync Inngest after any deploy touching `src/lib/inngest/**`.
- [ ] Harden rate limiting — move `checkRateLimit` (`src/lib/rate-limit.ts:31`) to an external atomic store (Upstash Redis / Vercel KV) before paywall/promo.
- [ ] Add `user_id` to `async_jobs` in `010_jobs_owner.sql` (`async_jobs(user_id text references users(clerk_id))`) so job ownership is explicit; update `POST /api/roadmaps/async:70` and `loadProgress`/`loadFullRoadmap` callers.
- [ ] Wrap `savePhase` (`src/lib/inngest/functions.ts:55`) in a Supabase transaction/rpc so `phase` + `lessons` rows are atomic.

### Phase 2 — MVP depth, polish & verification (3–5 days)

- [ ] **Smoke: Ultra-only generation** — on staging, generate a 4-week and a 12-week roadmap; verify titles are fully Ultra-phrased (no `Week` prefix, no `Python Syntax` template leakage), lesson counts vary by Ultra decision, and a forced Ultra outage fails the job with `Generation failed — please retry` rather than serving a template.
- [ ] **Code exercises (post-MVP if executable is required).** Add `code_submissions` table + sandboxed `POST /api/exec` (JS/Python, capped CPU/mem, no network), render `exercise` blocks with "Run + ask tutor to explain" loop. Reference `lesson-content-blocks.ts:12`.
- [ ] **Roadmap auto-revision (minimal).** Add `roadmap_revisions (roadmap_id, reason, diff jsonb, created_at)`. On `weak_topics.fail_count ≥ 3` or overdue `review_schedule` streak, surface "Reshape your path" CTA; when accepted, re-run Ultra for the next phase only (reuses `buildPhasePrompt` with Ultra-owned counts).
- [ ] **Long-range analytics.** Expand `src/app/analytics/page.tsx:43` from 7 days to a 30/90-day calendar/grid with a retention line chart from `review_schedule`. Underlying `daily_activity` already stores every day — front-end only.
- [ ] **Tutor code-debug panel.** Add monospace `textarea` in `src/app/tutor/page.tsx:17` (toggled by 📋) forwarding `TutorContext.codeInput` to `POST /api/chat:80`.
- [ ] **Marketing alignment.** Remove any hard-coded `Week N` / `40 lessons` copy in `README.md` / landing — phrasing is now `Ultra-generated, schedule-aware` per `planRoadmapSize` guidance.
- [ ] **Final gate:** `npm run lint && npm run typecheck && npm test` (151 tests) green, `rg -n "Fallback|generateFallbackRoadmap|Week 1|Python Syntax" src/` near-zero outside comments, no `allow_all_*` policies remain, no template lessons in a sampled Ultra roadmap.

**Suggested MVP exit criteria:** onboarding (6-step, multi-select, edit-prefill) → Ultra-generated roadmap (no template fallback, Ultra decides titles + lesson counts + objectives) persisted once with real UUIDs + prerequisites DAG → lesson generation (`content_json` quality ≥70) → AI quiz banks (`review_schedule` spaced repetition) → weakness loop (`weak_topics` → `weakness_insights` → dashboard chips + overdue queue → tutor context) → tutor (roadmap + lesson excerpt + weak topics, thread-persisted) → analytics (`daily_activity` heatmap) → RLS closed + lint/typecheck/test green on Vercel.
