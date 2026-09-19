# HiPath AI — Project Audit

> Generated: 2026-09-19 · Scope: full workspace scan (`src/`, `supabase/`, configs, env names only — no secrets read)
> Method: read all 45 source files + `001_hipath.sql`, API routes, lib, pages, components, git history.

---

## 1. Executive Summary

**Estimated completion: ~35–40% of the 6-feature vision (MVP skeleton works, depth is missing).**

| # | Core feature | Status |
|---|--------------|--------|
| 1 | Adaptive Roadmaps | 🟡 Partial — AI generation works (sync + Inngest async), but not adaptive post-creation |
| 2 | Weakness Detection | 🔴 Stubbed — `weak_topics` table exists but is never written; only a `localStorage` string array |
| 3 | Smart Quizzes | 🟡 Partial — static MCQs with 60% gate + sequential lock; no adaptive difficulty, no spaced repetition, no code execution |
| 4 | AI Tutor | 🟡 Partial — `/api/chat` + `/tutor` UI work via NVIDIA NIMs; no persistence, no real roadmap context, no code-debug loop |
| 5 | Analytics Dashboard | 🟡 Partial — 4 stat cards + level bar only; no heatmaps, benchmarks, trends |
| 6 | Collaborative Learning | 🔴 Missing — zero code (no groups, sharing, live sessions) |

**Primary tech stack (verified from `package.json`, code):**

- **Framework:** Next.js 15.4.11 (App Router) + React 19.2.8 + TypeScript (strict, but build checks disabled)
- **Styling:** Tailwind CSS v4 + `shadcn`-style `ui/` (button/card/input) + Framer Motion 13.2.0 + lucide-react 1.46.0
- **Auth:** Clerk (`@clerk/nextjs` 7.9.2) — middleware-gated routes + `verifyWebhook` user sync
- **DB / Backend:** Supabase Postgres (`@supabase/ssr` + `@supabase/supabase-js`) + raw SQL migration `supabase/migrations/001_hipath.sql`
- **AI:** NVIDIA NIMs only (`src/lib/nvidia.ts` — `chatWithFallback` / `streamWithFallback`, model chain from `NIM_FALLBACK_MODELS`, default `openai/gpt-oss-20b`)
- **Background jobs:** Inngest (`roadmap/generate` event → `generateRoadmapFn`) to bypass Vercel 10s limit; `vercel.json` sets 60s (roadmaps/chat) / 300s (inngest), region `iad1`
- **State:** `localStorage`-first (`hipath_roadmap`, `hipath_gamification`, `hipath_progress`) with best-effort Supabase sync in `src/lib/store.ts`. No Zustand/Redux/React-Query.

**Critical blockers / red flags (fix before MVP launch):**

1. **`async_jobs` table is referenced but never migrated.** `api/roadmaps/async/route.ts`, `api/roadmaps/status/[jobId]/route.ts`, and `lib/inngest/functions.ts` all read/write `async_jobs`, but `001_hipath.sql` does not create it. If it doesn't exist in the live DB, the entire async onboarding flow 404s/fails. **P0.**
2. **RLS is wide open.** Migration enables RLS then creates `allow_all_* … USING (true) WITH CHECK (true)` policies on all 10 tables. Any anon key holder can read/write any user's roadmaps, lessons, progress, chats. **P0 security.**
3. **Build safety nets are off.** `next.config.ts` sets `eslint.ignoreDuringBuilds: true` + `typescript.ignoreBuildErrors: true`. Type/runtime errors ship silently to Vercel. **P0 process.**
4. **Single-source-of-truth split (localStorage vs Supabase) + ID mismatch.** Onboarding polls the async job (which saves roadmap with UUID `jobId` and real lesson UUIDs), then *discards* that shape, rebuilds synthetic IDs (`p1-l1`), saves to `localStorage`, and calls `supabaseSaveRoadmap()` which inserts a **second duplicate roadmap**. Lesson page reads only `localStorage`, so `progress.lesson_id` (text `p1-l1`) can never satisfy the `lessons(id uuid)` FK, and Supabase progress sync silently fails. **P0 data integrity.**
5. **Env-var naming chaos + hardcoded fallbacks.** `.env.example` documents canonical names, but code accepts ~6 variants (`DATABASE_URL` as Supabase URL, `SERVICE_ROLE`, `NEXT_PUBLIC_SUPABASE_URL/ANON` with a literal slash, hardcoded project URL `yzqflukqyfvnvgbbrxff.supabase.co` in both Supabase clients). Mock Supabase clients swallow all errors and return `{data:null, error:null}`, hiding misconfiguration. **P1.**
6. **No test, seed, or backup story.** Zero `*.test.*` / `*.spec.*` files, no CI, README is stock `create-next-app`. **P1.**

---

## 2. Architecture & File Structure Map

```
HiPath AI/
├── src/
│   ├── app/
│   │   ├── page.tsx                          # Landing (hero, features, how-it-works, FAQ, footer)
│   │   ├── layout.tsx                        # Geist fonts + ClerkProvider + Providers (light-only)
│   │   ├── globals.css                       # Tailwind v4 tokens, --primary #6C5BFF, light only
│   │   ├── error.tsx / global-error.tsx
│   │   ├── sign-in/[[...sign-in]]/ + sign-up/[[...sign-up]]/  # Clerk hosted auth
│   │   ├── onboarding/page.tsx               # 6-step wizard → POST /api/roadmaps/async → poll status
│   │   ├── dashboard/page.tsx                # Stat cards + week grid + AI-mentor teaser
│   │   ├── roadmap/page.tsx                  # Phase accordion, grid/list toggle, Edit/Pause/Delete
│   │   ├── roadmap/[id]/lesson/[lessonId]/   # Content + example + MCQ quiz + 60% gate
│   │   ├── tutor/page.tsx                    # Chat UI (?q= prefill, SSE-capable but unused)
│   │   ├── analytics/page.tsx                # 4 cards + level progress bar
│   │   ├── settings/page.tsx                 # Config-driven tabs (?tab=), profile/appearance/…
│   │   ├── privacy|terms|cookies|contact/    # Static legal pages
│   │   └── api/
│   │       ├── roadmaps/route.ts             # Sync generation (5 phases/~40 lessons prompt)
│   │       ├── roadmaps/async/route.ts       # Creates async_jobs row + inngest.send
│   │       ├── roadmaps/status/[jobId]/route.ts  # Polls roadmaps → async_jobs
│   │       ├── chat/route.ts                 # Tutor endpoint (NIMs or keyword mock)
│   │       ├── inngest/route.ts              # Inngest serve() with request logging
│   │       └── webhooks/clerk/route.ts       # user.created → upsert users + gamification
│   ├── components/
│   │   ├── layout/Sidebar.tsx + Header.tsx   # App shell (⌘K search → tutor, streak/XP links)
│   │   ├── landing/LandingAuth.tsx           # Signed-in/out CTA swaps
│   │   ├── ui/button.tsx + card.tsx + input.tsx
│   │   └── providers.tsx                     # No-op (explicit light-only)
│   ├── lib/
│   │   ├── nvidia.ts                         # NIMs fallback client (JSON repair, SSE stream)
│   │   ├── store.ts                          # localStorage CRUD + Supabase sync helpers
│   │   ├── mockData.ts                       # Types only; generateMockRoadmap() throws by design
│   │   ├── gamification.ts                   # getLevel/xpForNextLevel/progressToNextLevel
│   │   ├── onboarding.config.ts              # 6 wizard steps + time/duration parsers
│   │   ├── settings.config.ts                # Settings tabs feature flags
│   │   ├── supabase/client.ts + server.ts    # Browser (anon) + server (service-role) clients
│   │   ├── inngest/client.ts + functions.ts  # generateRoadmapFn (prompt → parse → save)
│   │   └── utils.ts                          # cn()
│   └── middleware.ts                         # Clerk: public (/, legal, auth, webhooks, inngest) vs protected (dashboard, roadmap, tutor, analytics, settings, onboarding, chat/roadmap APIs)
├── supabase/migrations/001_hipath.sql        # 10 tables + open RLS policies (no async_jobs)
├── public/ (static SVGs only) · package.json · next.config.ts · tsconfig.json (@/* → ./src/*)
├── vercel.json (function timeouts) · eslint.config.mjs · postcss.config.mjs
└── .env / .env.local / .env.example (names audited only) · .gitignore (.env* ignored ✓, .vercel/ ignored ✓)
```

**Architectural pattern evaluation:**

- **Good:** App Router separation is clean; API layer is thin and single-purpose; config-driven UI (`onboarding.config.ts`, `settings.config.ts`) makes adding wizard options/tabs code-free; Inngest correctly isolates the >10s AI job from request/response; Clerk middleware correctly leaves `/api/inngest` and `/api/webhooks` public while protecting app + data APIs.
- **Weak:** No service/data-access layer — pages call `fetch()` + `localStorage` directly and Supabase from both client (`store.ts`) and server (routes/functions) with divergent shapes. No server components for data fetching, no React Query/SWR caching, no optimistic updates, no pagination. `store.ts` `isSupabaseConfigured()` reads `process.env` client-side (always `undefined` in the browser; only the hardcoded fallback URL saves it) — a sign the sync design was never validated in production.
- **Fragile:** `require("@clerk/nextjs")` inside `try/catch` in 4 client pages (dashboard, onboarding, settings, header/sidebar sign-out) instead of top-level `useUser()`/`useClerk()` imports — breaks Fast Refresh/lint, hides auth errors, and `lesson/page.tsx` reads `(window as any).Clerk?.user?.id` (always undefined) so its Supabase sync is dead code.

---

## 3. Database Schema State

### Current models (`001_hipath.sql`)

```
users (id uuid PK, clerk_id text UNIQUE NOT NULL, email, name, avatar_url, created_at)
  ↑ referenced by all user-scoped tables via clerk_id (text), NOT users.id
  ├── gamification (user_id text PK → users.clerk_id, xp, level, streak, best_streak,
  │                 pass_rate, study_minutes, lessons_done, last_study_date, updated_at)
  ├── roadmaps (id uuid PK, user_id text → users.clerk_id, title, description, goal,
  │             level, time_per_day, duration, why, style, status='active',
  │             progress, lessons_total, created_at)
  │     ├── phases (id uuid PK, roadmap_id → roadmaps, idx, title, created_at)
  │     │     └── lessons (id uuid PK, roadmap_id → roadmaps, phase_id → phases,
  │     │                 idx, title, content_md, example_code, quiz jsonb='[]',
  │     │                 xp_reward=20, created_at)
  │     └── chat_threads (id uuid PK, user_id → users.clerk_id, roadmap_id → roadmaps NULL, title, created_at)
  │           └── chat_messages (id uuid PK, thread_id → chat_threads, role CHECK user|assistant|system,
  │                             content, meta jsonb, created_at)
  ├── quiz_attempts (id uuid PK, user_id → users.clerk_id, lesson_id → lessons,
  │                  quiz_id text, answers jsonb, score, passed, created_at)
  ├── progress (id uuid PK, user_id → users.clerk_id, lesson_id → lessons,
  │            completed, passed, score, updated_at, UNIQUE(user_id, lesson_id))
  └── weak_topics (id uuid PK, user_id → users.clerk_id, topic, fail_count=1,
                   updated_at, UNIQUE(user_id, topic))
```

Notes: `roadmaps.level/time_per_day/duration/why/style` columns exist in SQL but the Inngest save path (`functions.ts:118-127`) doesn't write them (only `title/description/goal/lessons_total`). `quiz` is schemaless `jsonb` (`{q, options[], correct, explanation}[]`). `lessons_total`/`progress`/`gamification.*` are denormalized counters maintained client-side.

### Missing models (required for the 6 features)

| Feature | Missing table(s) / columns | Why |
|---------|----------------------------|-----|
| Async pipeline (exists in code, absent in SQL) | **`async_jobs` (id uuid PK, status, error, result jsonb, started_at, completed_at)** | Status polling + Inngest state depend on it; migration must be added |
| 1 Adaptive Roadmaps | `roadmap_revisions` (roadmap_id, reason, diff jsonb, created_at); `lessons.prerequisites uuid[]`, `lessons.difficulty`, `lessons.estimated_minutes`, `lessons.objective`; `roadmaps.current_phase_idx` | No versioning, pacing, or re-planning without this |
| 2 Weakness Detection | wire up existing `weak_topics` + add `weak_topics.lesson_id`, `last_seen_at`; or `skill_mastery (user_id, skill, mastery float, attempts)` | Table exists but unused; needs lesson linkage + decay |
| 3 Smart Quizzes | `quiz_questions` (lesson_id, type MCQ|code, difficulty, prompt, options, answer, explanation, tags); `quiz_attempts.question_id`, `time_spent_ms`, `spaced_repetition (user_id, question_id, easiness, interval_days, next_review_at)` / SM-2 fields | Current `quiz jsonb` can't do adaptive difficulty or spaced repetition; no code-runner results table |
| 4 AI Tutor | actually use `chat_threads/chat_messages` (add `lesson_id`, `model`, `tokens`) + `tutor_memory (user_id, key, value jsonb, updated_at)` | Tables exist but zero reads/writes in app code |
| 5 Analytics | `study_sessions (user_id, started_at, minutes, lessons_completed)` / `daily_activity (user_id, date, xp, minutes, lessons)`; `benchmarks` (static or cohort aggregates) | Heatmaps/streaks/benchmarks impossible from counters alone |
| 6 Collaborative | `study_groups (id, name, description, owner_id, created_at)`; `group_members (group_id, user_id, role)`; `shared_roadmaps (roadmap_id, group_id, shared_by)`; `group_sessions (group_id, starts_at, topic, meeting_url)` | Entire feature absent |
| Cross-cutting | `profiles` extension or `users.onboarding jsonb + preferences jsonb`; `notifications (user_id, type, payload, read_at)` | Settings → Notifications tab and onboarding prefill need a home |

Also consider: FKs reference `users(clerk_id)` (text) rather than `users.id` (uuid) — workable but non-idiomatic; pick one identity convention and add missing indexes (`roadmaps(user_id)`, `lessons(roadmap_id, phase_id)`, `progress(user_id)`, `chat_messages(thread_id)`) and `updated_at` triggers.

---

## 4. Feature Gap Analysis

### 1. Adaptive Roadmaps — 🟡 Partial
- **Exists:** 6-step onboarding wizard (`onboarding/page.tsx` + `onboarding.config.ts`) with draft persistence and edit-prefill; sync endpoint (`api/roadmaps/route.ts`, prompt demands exactly 5 phases/~40 lessons, unique titles) and async Inngest pipeline (`async/route.ts` → `roadmap/generate` → `functions.ts` → `status/[jobId]`) with 10-minute polling; roadmap viewer with accordion phases, grid/list toggle (`hipath_viewMode`), Edit/Delete/Pause buttons, DAG-prerequisite-ready lock helper.
- **Missing/broken:** async prompt only asks for **2 phases / 8 lessons** (contradicts sync prompt's 5/40 and landing-page claims); AI-failure fallback is a generic 8-lesson template labeled "(fallback)"; onboarding **throws away** the async result's real UUIDs and re-inserts a duplicate roadmap with fake `p1-l1` IDs; `level/time/duration/why/style` collected but not saved by the async path; Edit navigates to onboarding but never updates — it creates a new roadmap; Pause is `alert("coming soon")`; Delete clears only `localStorage`, orphaning Supabase rows; no re-planning, pacing, or difficulty adaptation after creation.

### 2. Weakness Detection — 🔴 Stubbed
- **Exists:** `weak_topics` table (migration) + `hipath_weak_topics` string array in `localStorage` (lesson page writes failed lesson titles there) + a "Ask mentor for help →" prefill button on quiz failure.
- **Missing/broken:** nothing ever writes to the `weak_topics` table (no `supabase.from("weak_topics")` call anywhere); no fail-count increment, no skill tagging, no mastery score, no roadmap adjustment, no remedial lesson injection. The "remedial suggestion saved!" toast only sets a chat prefill string. Real-time path adjustment: **0%**.

### 3. Smart Quizzes — 🟡 Partial (static)
- **Exists:** per-lesson MCQ renderer, answer gating (must answer all to submit), 60% pass threshold, sequential unlock (`isLessonLocked` in roadmap page + `locked` guard in lesson page), retry flow, +20 XP / streak / study-minutes update on pass, `quiz_attempts` + `progress` tables defined.
- **Missing/broken:** quizzes are AI-fallback placeholders (`What is {lesson}? / Option A–D, correct: 0`) — always answer "A" to pass; no adaptive difficulty, no question bank, no code exercises or runner, no timed/spaced-repetition scheduling, no per-question timing or explanation quality checks; `quiz_attempts` is never written from the lesson page (only `progress` via a dead Clerk lookup); division by `lesson.quiz.length` unguarded (empty quiz → `NaN` score).

### 4. AI Tutor — 🟡 Partial (stateless)
- **Exists:** `/tutor` chat UI with `?q=` prefill from dashboard/header/lesson, `POST /api/chat` with NIMs fallback chain, keyword mock when no key (`progress` query → stats reply), SSE-capable client renderer.
- **Missing/broken:** route returns plain JSON, never SSE, so streaming code is dead; no persistence — `chat_threads`/`chat_messages` tables exist but are never touched (no history, no "New Chat" backend, message count is session-only); context is 4 scalars (`roadmapTitle, level, xp, streak`) — no phases, current lesson, weak topics, or quiz history, so it is **not context-aware**; no code-debug flow (no code input, no runner, no lesson-grounded RAG); system prompt hardcodes "Computer Science & Technology" and mentions internal "fallback logic".

### 5. Analytics Dashboard — 🟡 Thin
- **Exists:** `/analytics` shows Level/XP/Pass Rate/Streak cards + level-progress bar (`progressToNextLevel`); header mirrors Lv/XP/streak; dashboard shows study-minutes/lessons stat cards.
- **Missing/broken:** no heatmap (dashboard "This Week" grid is hardcoded: first 3 days ✓ whenever any lesson is done), no benchmarks, no per-day minutes chart, no retention/accuracy trends, no study-session tracking (`studyMinutes` is `+15` on pass / `+5` on fail — fictional, not measured); "+0m vs last week" is a hardcoded string; analytics reads `localStorage` only (ignores Supabase); dark-mode classes exist in analytics but theme is forced light.

### 6. Collaborative Learning — 🔴 Missing
- **Exists:** none. No routes, tables, or UI for groups, shared roadmaps, invites, or live sessions. Sidebar has no entry; settings has no teams tab.
- **Missing/broken:** everything: `study_groups`, `group_members`, shared-roadmap links, activity feeds, group sessions/scheduling, presence. Do not advertise this feature until data model lands.

---

## 5. Code Quality & Security Report

**Security (highest priority):**
- `001_hipath.sql:133-145` — `allow_all_*` RLS policies (`USING (true) WITH CHECK (true)`) on all 10 tables. Anyone with the anon key can list/overwrite any user's data. Replace with `auth.jwt()` Clerk-ID-scoped policies + service-role-only writes before any production traffic.
- `lib/supabase/client.ts` + `server.ts` — hardcoded fallback project URL + silent mock clients (`{data:null, error:null}`) mask misconfiguration; server client falls back to `SERVICE_ROLE` env which may be empty, then lies about success. Fail loud, never mock the DB layer.
- `api/webhooks/clerk/route.ts` — no event-type check (processes `user.created`, `user.updated`, `user.deleted`, even `*` identically); no signature-env guard beyond `verifyWebhook`; blindly upserts `gamification` with zeros on *every* event (can reset XP on profile update — check `evt.type === "user.created"` and use `insert … onConflict do nothing` semantics).
- `nvidia.ts` — `NIM_KEY` read at module scope; key logged indirectly via `HTTP {status} {body}` error text which can leak upstream internals to logs; no rate limiting on `/api/chat` or `/api/roadmaps/*` (authenticated users can spam paid NIMs endpoints).
- `middleware.ts` — correct route split, but `/api/roadmaps/status/*` polling URL is predictable UUID (jobId = roadmap id) with no ownership check — combined with open RLS, any user can poll/read anyone's roadmap by ID enumeration.

**Bugs / edge cases found:**
- Missing `async_jobs` migration (see §1) — status endpoint returns 404/`not_found` or throws on `.single()` depending on mock vs real client.
- ID-shape split (`functions.ts` saves real UUIDs → `onboarding/page.tsx:120-137` rebuilds `p1-l1` string IDs → `lesson/[lessonId]` looks up `localStorage` only). Direct navigation to a Supabase-saved roadmap ID 404s; `supabaseSaveProgress(userId, "p1-l1", …)` violates `lessons.id` UUID FK (silently swallowed).
- Duplicate roadmap inserts: Inngest function inserts roadmap #1 (id = jobId); onboarding then calls `supabaseSaveRoadmap()` inserting roadmap #2 with the same content. Users accumulate ghost roadmaps.
- `onboarding/page.tsx:78` — polling loop swallows non-generation errors and keeps polling to 10 min; `pollStatus` percent is `attempt/maxAttempts`, not real progress.
- `lesson/page.tsx:63` — streak logic `streak = streak+1 > 0 ? … : 1` is convoluted; same-day re-pass double-counts `lessonsDone` and XP (no idempotency on `progress` upsert keyed by synthetic ID).
- `lesson/page.tsx:68-76` — Supabase sync reads `(window).Clerk.user.id` (never set) → progress/gamification never sync on quiz pass; `dashboard/page.tsx` uses `require("@clerk/nextjs")` `useUser()` conditionally (Rules-of-Hooks violation, works by accident).
- `api/roadmaps/route.ts` vs `functions.ts` prompt drift (5 phases/40 lessons vs 2/8); `roadmap/page.tsx` claims "40+ lessons" and landing claims "40 lessons" regardless of actual 8-lesson fallback.
- `chat/route.ts:10` — system prompt leaks implementation detail ("Use Nvidia-only fallback logic mentally"); mock reply echoes raw user input (`last.slice(0,120)`) without sanitization (stored XSS if ever rendered as HTML — currently `textContent`, low risk, but don't `dangerouslySetInnerHTML` later).
- JSON repair in `nvidia.ts:57` (`lastIndexOf("{")`) + duplicate logic in `functions.ts:81` can truncate valid nested JSON or stitch thinking-trace + JSON; `max_tokens: 2000` (sync) is too small for a 40-lesson roadmap — expect cut-off JSON → fallback path.
- `store.ts:43-44` — `isSupabaseConfigured()` checks `process.env.NEXT_PUBLIC_*` at runtime in the browser (always falsy); only the hardcoded URL keeps it alive. `loadRoadmapAsync` returns stale `localStorage` roadmap without ever checking Supabase for newer data.
- `tutor/page.tsx:32-49` — prefill auto-send fires inside `setTimeout` without cleanup/loading guard; double-mount (StrictMode) sends twice.

**Performance / bottlenecks:**
- `supabaseSaveRoadmap()` inserts phases/lessons with sequential `await` in loops — 40 lessons ≈ 40+ round trips; batch via single `insert([...])` per table.
- `roadmap/page.tsx` + `lesson/page.tsx` flatten all phases/lessons on every render; fine at 8 lessons, janky at 40+ with Framer Motion `whileHover` per card — memoize (`useMemo`) and virtualize or paginate phases.
- `dashboard/page.tsx` fires 3 Supabase queries in `Promise.all` on every `user.id` change with no abort/dedupe; combined with local-first paint this is fine today but will over-fetch once real sync lands — move to SWR/React Query with caching.
- Inngest `step.run("nvidia-sync")` uses a 120s timeout inside a 300s Vercel window — one slow model consumes the whole budget; the single-model chain (`openai/gpt-oss-20b` only) means no real fallback despite the "5-model" copy on the landing page.
- Dependencies: `framer-motion@13` predates React 19 (peer warnings / potential concurrent-mode issues — upgrade to `motion` v11+/framer-motion v12); `lucide-react@1.46` is ~2 years stale (icon gaps); `inngest@4.20` is fine but event-key missing locally breaks `inngest.send` → job marked failed with no retry UI.

**Hygiene:** no tests/lint-in-CI (and lint ignored at build); `README.md` is stock template (no setup, env, migration, or Inngest dev instructions); `.env` + `.env.local` present locally (correctly git-ignored, but canonical names in `.env` don't match `.env.example` — onboarding docs needed); `tsconfig.tsbuildinfo` + `.next/`/`vercel/` committed-adjacent (build artifacts in workspace, harmless but noisy).

---

## 6. Action Plan (Next Steps)

Ordered for a functional, secure MVP. Check off in sequence — each phase unblocks the next.

### Phase 0 — Stop the bleeding (½ day)
- [ ] Add `supabase/migrations/002_jobs.sql`: create `async_jobs (id uuid PK, status text, error text, result jsonb, started_at timestamptz, completed_at timestamptz)` + restrictive RLS. Verify `/api/roadmaps/status/[jobId]` returns `processing → completed` end-to-end.
- [ ] Replace `allow_all_*` policies with Clerk-JWT-scoped policies (or keep RLS closed + service-role-only server writes). Confirm anon key can no longer list `roadmaps`.
- [ ] Remove `eslint.ignoreDuringBuilds` + `typescript.ignoreBuildErrors` from `next.config.ts`; run `npm run lint && npx tsc --noEmit` green.
- [ ] Unify env names to `.env.example` canonical set; delete hardcoded `yzqflukqyfvnvgbbrxff` fallbacks and mock Supabase clients (throw if unconfigured). Update `.env.local` accordingly.

### Phase 1 — Single source of truth (1–2 days)
- [ ] Decide: **Supabase is primary, localStorage is cache**. Stop generating `p1-l1` IDs — persist the Inngest-saved UUIDs straight to cache (`supabaseSaveRoadmap` becomes upsert-by-id; delete the duplicate-insert call in `onboarding/page.tsx`).
- [ ] Fix Clerk identity properly: top-level `useUser()` imports everywhere; remove all `require()` and `(window).Clerk` hacks; pass `userId` into every sync helper.
- [ ] Make lesson/roadmap/dashboard pages read Supabase first (server components or SWR), fall back to cache offline. Add `supabaseSaveProgress` + `quiz_attempts` insert on every quiz submit (currently dead).
- [ ] Harden Clerk webhook: `if (evt.type !== "user.created") return`; never overwrite existing `gamification` row.
- [ ] Batch Supabase inserts (one `insert` per table) and align sync/async prompts (single shared prompt builder, 5 phases/~40 lessons, `max_tokens ≥ 8000`).

### Phase 2 — MVP feature depth (3–5 days)
- [ ] **Quizzes:** replace placeholder quiz with per-lesson AI-generated MCQs (3–5 Qs, real distractors); store in `lessons.quiz`; log every attempt to `quiz_attempts`; guard empty-quiz division; add per-question explanations UI (already rendered — feed it real data).
- [ ] **Weakness detection (minimal):** write failures to `weak_topics` (upsert + `fail_count++`); surface "Weak areas" chip row on dashboard; lesson-fail CTA prefills tutor with lesson context.
- [ ] **Tutor context:** pass current roadmap + current lesson + last quiz score into `/api/chat` system prompt; persist threads/messages to `chat_threads/chat_messages`; implement thread list + resume (replaces session-only count).
- [ ] **Analytics (minimal):** add `daily_activity` logging (real minutes from lesson dwell time, not +15); render a true 7-day heatmap from it; replace hardcoded "+0m vs last week" and fake week grid.
- [ ] **Roadmap ops:** implement real Edit (update, not duplicate), Delete (cascade Supabase + clear cache), and remove Pause or implement streak-freeze honestly.

### Phase 3 — Differentiation (post-MVP)
- [ ] Adaptive difficulty + spaced repetition (`quiz_questions`, SM-2 `next_review_at`, code-exercise type + runner).
- [ ] Roadmap auto-revision (`roadmap_revisions`, re-plan on repeated failures, pace adjustment from `daily_activity`).
- [ ] Benchmarks/cohort stats, notifications (Inngest cron + Resend — `RESEND_API_KEY` already in `.env`), dark mode (remove forced-light).
- [ ] **Collaborative learning (Feature 6):** `study_groups` → `group_members` → `shared_roadmaps` → `group_sessions`; sidebar entry; share-link flow. Entirely greenfield — schedule after MVP metrics validate core loop.
- [ ] Tests + CI: at minimum, unit tests for `gamification.ts`, prompt builder, JSON-repair, and polling state machine; `README.md` with setup/migrate/dev (`npx inngest-cli dev`) instructions.

**Suggested MVP exit criteria:** onboarding → 40-lesson AI roadmap persisted once (no duplicates) → lesson quiz gates progress and logs attempts → failures land in `weak_topics` and surface on dashboard → tutor answers with lesson-aware context and persists history → analytics heatmap reflects real activity → RLS closed + `tsc`/`lint` clean on Vercel.
