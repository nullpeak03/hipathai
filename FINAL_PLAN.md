# HiPath AI — Final Production Plan (Real, No Template, Hobby-Safe)

**Date:** 2026-09-12 · **Stack:** Next.js 16.3.4 + Clerk + Supabase + NIM (Gemini 2.5 Flash primary) + Vercel Hobby + PWA · **Mode:** Real AI only, no mock, no template, `after+waitUntil` for Hobby 10s.

## 1. Roadmap Generation (Real, Deterministic First)

**Flow:**
- `POST /api/roadmaps/generate` validates `DraftSchema` (track 2-40, goal 4-300, level Beginner/Intermediate/Advanced/Expert, stack max12, hrs 1-12, deadline future `YYYY-MM-DD`, days 2-7, session 15/30/60/90/120, style video/reading/project/mixed, motivation/preferredResources/portfolioUrl/constraints optional).
- Inserts `roadmaps(status=generating, idempotency_key)` with dedup by `idempotency_key` + 10m window.
- **Background `bgPromise` via `after()+waitUntil`:**
  1. **Deterministic personalized (real, <50ms) → ready immediately:** Builds `3 phases ×3 nodes` from `Track/Goal/Level` (e.g., `AI/ML → Python & Data / ML Foundations / AI Agents`), `order` sequential, `locked: o!==0`, `status: open/locked`, `weak:false`, `title: Track — Goal.slice(0,60)`, `totalWeeks: 8/6/4`. Updates `roadmaps` `status=ready`, `nodes`, `title`, `total_weeks`, `ai_logs provider: deterministic`, archives old `ready`.
  2. **Pre-generate lessons 0,1** (`waitUntil` parallel `callAI task:lesson GEMINI 2500` + `Promise.all videoOk`) → cache `nodes[].lesson` for `01.1` + `01.2` so `01.2` opens instantly when unlocked.
  3. **Upgrade to AI** (`callAI task:roadmap GEMINI 2800, json_object, 9s timeout`): If succeeds, overwrites `nodes` with AI `phases` (still `locked` logic), updates `roadmaps` again. If fails, keeps deterministic (real).

**Polling:** `GET /api/roadmaps/:id` every 3s for 6m; `heal 45s → failed` (now rarely hits because deterministic is ready in 50ms).

## 2. Lesson Gating (order+1 + Phase-Gate)

- **Initial:** `Phase 01` only `Node 01.1` `open`, `01.2` `locked` but **already cached** (pre-gen), `01.3+` `locked` not yet generated, `02.1+` `locked` (phase-gate).
- **Quiz Grade `POST /api/quiz/grade`:** `score >=70` → `node.status=done`, then `next = nodes[idx+1]`; **phase-gate** `if (next.phaseIndex > curPhase) check all curPhase nodes done` before unlocking `next`. `unlockedNext = next.order` returned.
- **Lookahead:** If `pass`, `lookahead = nodes[unlockedNext+1]` where `type=lesson` and no `lesson`, `waitUntil` generates it (so `01.3` is ready when `01.2` completes).

**Example:** `01.1` open, `01.2` locked+pre-generated, `01.3` locked not generated. Pass `01.1` → `01.2` unlocks (cached), `01.3` starts generating. Pass `01.2` → `01.3` unlocks (now cached), `02.1` stays locked until `01.3`+`01.4`+`01.5` all `done` (phase-gate).

## 3. All Pages Cockpit (Real Data, Emerald, No Show-Only)

**Tokens:** `bg #050A08`, `panel #0A120E`, `border #10B98122`, `primary #10B981`, `text #E6F4ED`, `muted #8BA494`, `radius 12/8`, `Space Grotesk/Inter/JetBrains Mono`.

- **Landing** (`app/page.tsx`): `framer-motion` hero + 4 steps + 6 features + tutor demo + sample + FAQ (new professional accordion, no `terminal-card`) + footer `Product/Legal` (Privacy/Terms/Cookie linked) + `robots/sitemap/opengraph` + `<main>`.
- **Onboarding** (`app/onboarding/page.tsx`): 6 steps flexible (`Goal+Track` 15 tracks + Custom, `Level & Stack` 20 stacks + Custom, `Rhythm` 90/120, `Style` 4 + resources, `Motivation` + portfolio/constraints, `Review`), `future date only`, `progress role=progressbar`, `aria-pressed`, `44px` touch, `hipath-onboarding-draft` 500ms debounce, `idempotency_key`, `You already have a path` choice.
- **Dashboard** (`app/app/dashboard/page.tsx`): `aside w-64` + `header` (no search) + 4 stats (`velocity done/total`, `streak`, `daily quota todayMins/60`, `mastery quizAvg`) + hero `ACTIVE MODULE` (`firstOpen` + `sandbox` code + `checkpoint`) + `Protocol Checklist 01-04` + bottom `Areas (weak)` + `Navigator`, all from `roadmaps.nodes` + `progress_events` + `users`.
- **Roadmap** (`app/app/roadmap/[id]/page.tsx`): `PATHWAY` bar + header `ACTIVE SPECIALIZATION TRACK` + `AI Adaptation` banner + `Phase 01 IN PROGRESS` (nodes `DONE/ACTIVE/REMEDIAL/LOCKED`) + `Phase 02` 2×2 `READY/QUEUED` (links to lesson per your `yes show lessons`) + right telemetry `74%`, `CONFIDENCE 0.88`, `weekly pace`.
- **Lesson** (`app/app/lesson/[id]/[order]/page.tsx`): **Content only** per your `lesson page is only for content`, `60/40` split: left `objectives` + `ReactMarkdown` `md` + `codeExamples` `copy` + `load`, right `video/summary/notes` tabs + `Generate Quiz →`, no `Run` (tutor has it).
- **Tutor** (`app/app/tutor/page.tsx`): 3-col `260px_1fr_300px`, left `ACTIVE LESSON NODE` + `THREAD HISTORY` (real `tutor_threads` grouped `Today/Yesterday/Previous`, `+ New chat` POST, searchable, `title` + `language`, clickable, `⋯` rename/delete), manual `LANGS` dropdown (`python..sql`, default `python`), center SSE `ULTRA→LIGHTNING→GEMINI` + `Socratic Hint`, right `STUDENT MENTAL MODEL` + `scratchpad.{lang}` + `Run` via `POST /api/run` (Piston `emkc.org`, **every language** `python/js/ts/java/go/rust/c/cpp/csharp/php/ruby/swift/kotlin/bash/sql` via `LANG_MAP`) + `stdin` + `TERMINAL OUTPUT`.
- **Projects** (`app/app/projects/[id]/[order]/page.tsx`): `CONNECTED REPOSITORY` (real `api.github.com` `pulls`), `PRS 04`, `CREDITS`, `SLA`, `CI PIPELINE 4/6`, `DIFF TELEMETRY`, `UPCOMING` 3 locked projects, `LEDGER`.
- **Analytics** (`app/app/analytics/page.tsx`): 4 telemetry cards + heatmap + logs + adapt, all real `progress_events`/`ai_logs`.
- **Profile/Settings** (`app/app/profile|settings/page.tsx`): cockpit, real `xp/streak/goal` + `Verified Competencies` + heatmap + `Danger Zone`.

## 4. DB & APIs (Production)

- **Supabase** `supabase/schema.sql` (single file, `pgcrypto`+`pg_trgm`, `users` `settings/display_name/updated_at`, `roadmaps` `updated_at/idempotency_key`, `tutor_threads` `title/roadmap_id/language/updated_at`, `rate_limits`, triggers, RLS `clerk_owns_*`).
- **Migrations** `002_003_004_005` merged, but `schema.sql` is source of truth for wipeout.
- **APIs:** `roadmaps/generate` (GEMINI primary, deterministic first), `lessons/generate` (GEMINI, `maxDuration 60`, `Promise.all videoOk`, `checkAiDayAsync`), `quiz/generate|grade` (LIGHTNING + phase-gate + lookahead), `tutor/chat` (SSE), `tutor/threads` (POST/PATCH/DELETE, `roadmap_id` scoped), `run` (Piston, every language, `8s` timeout), `analytics`, `me/*`, `webhooks/clerk` (svix).
- **Rate limit:** `lib/rateLimit.ts` Supabase `rate_limits` table (shared, not `Map`), `isAnon` → `401` for POST.
- **Auth:** `proxy.ts` (`isAppRoute` `/onboarding|/app`), `app/sign-in/up` server guard `getActiveRoadmapId` → `dashboard` if `ready` else `onboarding`, `ClerkProvider` `signInUrl`, `forceRedirectUrl` absolute.

## 5. PWA & Deploy

- `next-pwa` `public/sw.js`, `manifest.json` `#050A08`, `offline` page, `InstallButton`, `next.config.ts` `headers` CSP (`clerk.hipathai.me`, `challenges.cloudflare.com`, `generativelanguage.googleapis.com`, `emkc.org`), `proxy` not `middleware`, `runtime nodejs` for `opengraph-image`.

## 6. Verification

- `POST /api/roadmaps/generate -H X-Forwarded-For: new-ip` (with Clerk) → `200 generating` `<200ms` → poll `GET` every `3s` → `ready` in `~1s` (deterministic) + `nodes[0].lesson && nodes[1].lesson` cached, `nodes[0].locked=false`, `nodes[1].locked=true`, `02.1.locked=true` until `01.x` all `done`.
- `POST /api/quiz/grade` `score 80` for `01.1` → `unlockedNext 1`, `GET` shows `01.2` `open`, `01.3` generating.
- `tutor` `+ New chat` → `POST` → appears in `Today`, `Run` `python`/`javascript` → `Piston` real `stdout`.
- `npm run build` `✓ Compiled` `19/19` static.

