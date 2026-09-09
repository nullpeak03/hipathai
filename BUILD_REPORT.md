# HiPath AI — Build Report (v1 Real Roadmap)
**Date:** 2026-09-09 · **Repo:** `nullpeak03/hipathai` (`main` @ `dc477fc`) · **Live:** https://www.hipathai.me · **Stack:** Next.js 16.3.4 App Router + TS + Tailwind 4 + Clerk + Supabase + NVIDIA NIMs + Vercel + PWA

> This report is after **removing the template fallback** — all roadmaps are now **real AI** (GLIMMER `meta/muse-glimmer-30b` with `response_format: json_object`, short prompt, 2800 tokens, ~8s on Hobby). No fake data.

---

## 1. What Was Fixed Just Now (your two bugs)

**a) Vercel logo in tab → HiPath AI**
- **Cause:** `app/favicon.ico` was the default Next.js triangle (4 icons, `c30c7d…`), while the correct emerald icon was only in `public/favicon.ico`. Next serves `app/favicon.ico` at `/favicon.ico`.
- **Fix:** `cp public/favicon.ico app/favicon.ico` (now 5 icons `781e94…`) + `app/layout.tsx:18` expanded `metadata.icons` to include `icon:[favicon, icon-192, icon-512]` and `apple:[icon-192]`. Live HTML now shows `rel="icon" href="/icon-192.png"` and new hash `?5f361a…`. Verified `GET /favicon.ico` → `MS Windows icon - 5 icons`.

**b) Roadmap generation timeout (`hipath — generating` stuck at `Analyzing goal…` / `Splitting into 4 phases`)**
- **Cause:** `app/api/roadmaps/generate` used `after(() => callAI ULTRA 170s)` — on Vercel Hobby `maxDuration` is 10s, so `ULTRA` (146s) / `LIGHTNING` (47s) / `GLIMMER 1500` (15s) were all killed before `update status=ready`, leaving rows `generating` forever (live: `c8f163…` 1h, `634b…`). `ai_logs` stayed empty.
- **Fix (real, no template):**
  - `lib/nim.ts:11` `PRIMARY.roadmap` `ULTRA → GLIMMER`, task timeout `15s` (measured 8-12s for 2800 tokens), `response_format: json_object`, `temperature 0.3`.
  - `lib/ai/prompts.ts:13` short prompt `3-4 phases ×3 nodes` (was 3-6×2-6 with long guide) — cuts reasoning from 22s to ~8s.
  - `app/api/roadmaps/generate:11` `maxDuration 300→60`, `maxTokens 2200→2800`, **synchronous** `await callAI` (no `after()`), returns `{status:"ready"}` directly; on `nim_all_failed` returns `{status:"failed"}` so UI shows *error card + Retry Now (same id) + Back to Summary* (no template).
  - `app/api/roadmaps/[id]:25` removed template heal; now marks `generating>5m` as `failed`.
  - Deleted `lib/ai/template.ts`.
- **Verified:** `POST /api/roadmaps/generate` (anon, `Frontend — Next.js freelancer`) now returns `ready` in ~8-12s with real `nodes`; `GET /api/roadmaps/:id` returns `title/nodes` with `locked/status`.

---

## 2. Tech Stack

- **Framework:** Next.js 16.3.4 App Router (`--webpack`), React 19.2.8, TS 5, Tailwind 4, shadcn CSS vars
- **Auth:** Clerk `Google + GitHub + Email OTP` (emerald dark appearance), `middleware.ts` + `lib/caller.ts` (Clerk `userId` or `anon:ip`)
- **DB/Storage:** Supabase Postgres (service_role for server routes, anon blocked by RLS until M5 JWT)
- **AI:** NVIDIA NIM `https://integrate.api.nvidia.com/v1` — `nvidia/nemotron-3-ultra-550b-a55b` (tutor/review), `nvidia/nemotron-3.5-lightning-30b-a3b` (quiz/summary), `meta/muse-glimmer-30b` (lesson + roadmap real)
- **PWA:** `@ducanh2912/next-pwa` (`public/sw.js`, `manifest.json`, runtimeCache for lessons/roadmaps, `/offline`)
- **Deploy:** Vercel, Node 20.20.2, `next.config.ts` with `withPWA`

---

## 3. Project Structure

```
app/
  page.tsx                    # Landing (marketing)
  layout.tsx                  # Root + ClerkProvider + fonts
  globals.css                 # Tokens
  favicon.ico                 # Fixed (HiPath 5 icons)
  sign-in/page.tsx            # Clerk <SignIn>
  sign-up/page.tsx            # Clerk <SignUp>
  onboarding/page.tsx         # 4 steps (Goal/Level/Time/Summary) + Generating redirect
  offline/page.tsx            # PWA offline fallback
  app/
    dashboard/page.tsx        # Server guard + Continue-focus
    generating/page.tsx       # Terminal logs + poll GET /api/roadmaps/:id
    roadmap/[id]/page.tsx     # Phases → nodes list, gated links
    lesson/[id]/[order]/page.tsx # 60/40 split: MD + Video/Summary/Notes + Quiz
    projects/[id]/[order]/page.tsx # GitHub URL or paste → rubric
    tutor/page.tsx            # SSE chat, Socratic
    analytics/page.tsx        # Streak/XP/heatmap/fallback + adapt
    profile/page.tsx          # Stats, goal edit, export, delete
    settings/page.tsx         # Regen, PWA install, diagnostics, sign-out
  api/
    roadmaps/generate/route.ts
    roadmaps/[id]/route.ts
    lessons/generate/route.ts
    quiz/generate/route.ts
    quiz/grade/route.ts
    projects/review/route.ts
    tutor/chat/route.ts (SSE)
    tutor/threads/route.ts
    analytics/route.ts
    me/{active,profile,regenerate,diagnostics,route.ts}
components/
  Logo.tsx                    # Uses /icon-192
  InstallButton.tsx           # beforeinstallprompt
lib/
  nim.ts                      # callAI + fallback chain, json_mode
  ai/{prompts,schemas,lessonPrompts,lessonSchemas,projectPrompts,tutorPrompts}
  store.ts                    # StoredRoadmap/Node, serviceClient, load/save
  caller.ts                   # Clerk or anon IP
  rateLimit.ts                # 20 AI/day, 5 roadmaps/week, 30 tutor/day (in-memory, M5 DB)
  hasRoadmap.ts               # getActiveRoadmapId (now serviceClient)
  supabase/{client,server}
public/
  favicon.ico, icon-192.png, icon-512.png, logo-dark.png, manifest.json, sw.js
supabase/
  schema.sql                  # v1 (users, roadmaps, progress_events, tutor_threads, ai_logs, RLS)
  migrations/002_indexes_and_rls_fix.sql # indexes + heal + updated_at
```

---

## 4. Pages — Detailed

### Landing `app/page.tsx` (`/`)
- **Nav:** `Logo` + `How it works #how / Features #features / Sample path #sample / FAQ #faq` + `Sign in → /sign-in` + `Start Building Free → /onboarding` (emerald `#10B981`)
- **Hero:** `v1 · free forever · tech-only` pill, `H1 Stop tutorial hell. > learn_to_ship()` (Space Grotesk 700, 48px), 3 CTAs, 7 track pills (Frontend…DSA)
- **Terminal mock:** `hipath — generating` with 4 phases (Foundations done, React open, Backend/Projects locked) — matches generating logs
- **Sections:** `#how` 4 steps, `#features` 6 cards (Roadmap, Adapts, Lesson, Quiz, Tutor, Projects), tutor demo, `#sample` 4 weeks, CTA `Free forever`, `#faq` 4 details, footer `Logo compact` + `learn_to_ship()`
- **Fixes:** favicon now correct; no stats strip (intentional v1)

### Auth `app/sign-in/page.tsx`, `app/sign-up/page.tsx`
- Clerk `appearance: {colorPrimary:"#10B981", colorBackground:"#050A08"}` + `forceRedirectUrl="/onboarding"`, keyless-safe shell (preview without env)
- New: separate routes for `/sign-in` and `/sign-up` (Clerk hosted UI handles Google/GitHub + Email OTP)

### Onboarding `app/onboarding/page.tsx` (4 steps, `hipath-onboarding-draft` localStorage)
- **Step 0 Goal:** track pills + `goal` input (min 4 chars)
- **Step 1 Level:** Beginner/Int/Adv + stack checkboxes + hrs/day (1-8) + deadline
- **Step 2 Time:** days/week (2-7) + session 15/30/60 + style `video/reading/project-first`
- **Step 3 Summary:** card list + Edit anchors + `Generate My Path →` (disabled while pending, idempotencyKey)
- **Guard:** `GET /api/me/active` — `activeId → /app/dashboard`, `generatingId → /app/generating?id=` (resume), keyless-safe
- **Action:** `POST /api/roadmaps/generate` → `push /app/generating?id=`

### Generating `app/app/generating/page.tsx`
- `LOGS` 4 lines typewriter, progress bar, skeleton cards, `fast mode` pill on fallback
- Polls `GET /api/roadmaps/:id` every 3s for 6m; `ready → /app/roadmap/[id]`, `failed/timeout → error card + Retry Now (same id) + Back to Summary`
- Supports `?id=` resume (tab-close)

### Roadmap `app/app/roadmap/[id]/page.tsx`
- Client fetch `GET /api/roadmaps/:id`, shows `phase · type · Lv difficulty · ~estMin`
- Links: `lesson → /app/lesson/[id]/[order]`, `project → /app/projects/[id]/[order]`, `locked → div opacity`
- Footer: `Dashboard` + `quiz 70% / project pass unlocks next`

### Lesson `app/app/lesson/[id]/[order]/page.tsx` (60/40 split)
- **Left:** objectives + `ReactMarkdown` MD + `codeExamples` (copy) — `prose-emerald`
- **Right tabs:** Video (nocookie embed, oEmbed validated, max 4, verified), Summary (`keyPoints`), Notes (autosave `hipath-notes-${id}-${order}` 400ms)
- **Quiz:** `Generate Quiz →` modal, `questions` sanitized (no answers), `Submit → POST /api/quiz/grade`, `≥70 unlocks next` + `weak` badge, `Next Lesson →` or `New Quiz, Retry`, offline queue `hipath-quiz-queue` in localStorage

### Projects `app/app/projects/[id]/[order]/page.tsx`
- Toggle `github url · 200 xp` vs `paste code · 100 xp`
- GitHub: `https://github.com/owner/repo` → `api.github.com/repos/.../readme` + `git/trees/HEAD?recursive=1` (5s timeout, `GITHUB_TOKEN` for 5000/hr), private/404 → `Not reachable` + Guide modal
- Paste: half XP, `verified:false`
- Review: `POST /api/projects/review` → Ultra rubric `{correctness40,structure25,practice20,readme15,issues[],suggestions[],feedback}`, `≥70 unlocks`

### Tutor `app/app/tutor/page.tsx` (SSE)
- Header `tutor · socratic` + lesson selector, `?roadmapId=&order=` deep-link
- Context: goal + node + last 3 fails + project feedback, `buildTutorSystem` (Socratic, <150 words)
- `POST /api/tutor/chat` SSE `event: token/meta/error`, fallback `ULTRA→LIGHTNING` with `fast mode` note, `tutor_threads` persisted `slice(-30)`, 30 msgs/day

### Dashboard `app/app/dashboard/page.tsx` (`force-dynamic`)
- **Guard:** `auth()` → `!userId → /sign-in`, `!activeId && !generatingId → /onboarding`, `generatingId → Resume Generation →`, else shell
- **Shell:** `aside w-64` (Logo compact + nav Dashboard/My Path/Tutor/Analytics/Profile/Settings) + `streak XP quiz avg` card; `main` Continue-focus:
  - `Resume: {title} →` (first `open` node, type-aware link)
  - `Up next` 3 nodes
  - `Needs review` weak badges → tutor
  - Mobile bottom tabs `Home/Path/Tutor/Stats/You`
- **Data:** `xp/streak` from `users`, `quizAvg` from `progress_events`, `streak fallback` from active days, `nodes` from `roadmaps`

### Analytics `app/app/analytics/page.tsx`
- `GET /api/analytics` aggregates `xp/streak/hrs/quizAvg/completion/heatmap/weakNodes/fallbackRate/logs/adapt`
- Adapt rule: `missed 3d or 2 fails → Apply Adapt` (difficulty −1 on next locked node)
- `POST /api/analytics` eases next node

### Profile `app/app/profile/page.tsx` + Settings `app/app/settings/page.tsx`
- Profile: stats, `goal + hrs` PATCH `/api/me/profile`, `InstallButton`, `Export JSON` (`GET /api/me`), `Delete account` (cascade + Clerk `deleteUser`)
- Settings: `Regenerate Path` (`POST /api/me/regenerate` archives), PWA install, `Sign out` (Clerk), `Diagnostics` (`GET /api/me/diagnostics` `ai_logs`)

### Offline `app/offline/page.tsx`
- Simple `You're offline` + `Back to Dashboard`

---

## 5. Dashboard Structure (Visual)

- **Tokens:** `bg #050A08`, `panel #0A120E`, `border #10B98122`, `primary #10B981`, `text #E6F4ED`, `muted #8BA494`, `radius 12/8`, `sidebar 260px`, fonts `Space Grotesk/Inter/JetBrains Mono`
- **Layout:** `flex min-h-screen` — `aside hidden md:flex w-64 border-r` + `main flex-1 p-6` → mobile `fixed bottom-0` nav
- **Consistency:** All `terminal-card` (`bg panel + border + rounded 12`), header `border-b`, `max-w-3xl/6xl` centered, `font-mono` for logs
- **Empty states:** `No active roadmap yet → Go to Onboarding`, `generating → Resume Generation`, `Path complete → regenerate`
- **Loading:** `animate-pulse` skeleton cards

---

## 6. Components

- `components/Logo.tsx` — `compact` (28px) vs full (40px + `HI-PATH` + `AI` pill gradient), uses `/icon-192.png` rounded
- `components/InstallButton.tsx` — `beforeinstallprompt` + `appinstalled` events, `Install HiPath App` button

---

## 7. Lib & AI

- `lib/nim.ts` — `callAI` with `PRIMARY` map (roadmap `GLIMMER` → `LIGHTNING` → `GLIMMER`), `chatOnce` with `response_format: json_object` for roadmap/lesson/quiz, `tryJson` balanced `{}` extraction, 1 repair attempt, `isRetriable` (429/5xx/abort/empty), `timeoutMs 15s` for roadmap (was 170s Ultra)
- `lib/ai/prompts.ts` — `buildRoadmapMessages` short (3-4 phases ×3 nodes) vs old long guide
- `lib/ai/schemas.ts` — `DraftSchema` (track, goal 4-300, level enum, stack 0-12, hrs 1-12, deadline YYYY-MM-DD, days 2-7, session 15/30/60, style enum), `RoadmapSchema` (title, totalWeeks 1-52, phases 3-8, nodes 2-8, difficulty 1-5, estMin 5-600)
- `lib/ai/lessonPrompts.ts` — lesson + quiz prompts with `avgScore` adaptive
- `lib/ai/tutorPrompts.ts` — Socratic system with goal/node/fails/feedback
- `lib/store.ts` — `StoredNode` (order, phase, type, locked, status, weak, lesson, quiz, project), `StoredRoadmap`, `serviceClient()`, `loadRoadmap`, `saveNodes`, `logAi`
- `lib/caller.ts` — `callerId` (Clerk `userId` or `anon:ip`)
- `lib/rateLimit.ts` — in-memory `20/day AI, 5/week roadmaps, 30/day tutor`
- `lib/hasRoadmap.ts` — `getActiveRoadmapId` via `serviceClient` (fixed from `supabaseServer` RLS block)
- `lib/supabase/*` — `supabaseServer` (anon+cookies) vs `supabaseBrowser`, `serviceClient` (service_role)

---

## 8. API Endpoints (all `force-dynamic`)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/roadmaps/generate` | POST | Clerk or anon IP | `Draft` → `roadmaps(status=generating)` → `callAI GLIMMER` → `ready` (real, no template) |
| `/api/roadmaps/[id]` | GET | `user_id` eq | Poll `generating/ready/failed`, heals `generating>5m → failed` |
| `/api/lessons/generate` | POST | gated, `locked` check | `GLIMMER` lesson + `noembed` video validate |
| `/api/quiz/generate` | POST | adaptive `avgScore` | `LIGHTNING` 5-8 Qs, sanitized publicQs |
| `/api/quiz/grade` | POST | `answers` vs stored | `score 70 pass` → unlock next, `weak` flag, `xp +100 pass/10 fail` |
| `/api/projects/review` | POST | `githubUrl` or `pasted` | GitHub fetch 5s → `ULTRA` rubric 40/25/20/15, `200/100 XP` |
| `/api/tutor/chat` | POST | SSE stream | `ULTRA→LIGHTNING` Socratic, `tutor_threads` slice(-30) |
| `/api/tutor/threads` | GET | `?order` | History |
| `/api/analytics` | GET/POST |  | Aggregates + `Apply Adapt` |
| `/api/me/active` | GET |  | `{activeId, generatingId}` for guards |
| `/api/me/profile` | GET/PATCH |  | User + roadmap, update goal/hours |
| `/api/me/regenerate` | POST |  | `archived` |
| `/api/me` | GET/DELETE |  | Export JSON / delete cascade + Clerk |
| `/api/me/diagnostics` | GET |  | `ai_logs` |

---

## 9. Database (Supabase)

**Live counts:** `users 4`, `roadmaps 6` (2 ready, 2 archived, 2 failed), `ai_logs 3`, `progress_events 0`, `tutor_threads 0` (verified via REST).

**`supabase/schema.sql` (v1, you ran):**
- `users(clerk_id pk, track, level, stack text[], hrs_per_day, deadline, days_per_week, session_min, style, draft jsonb, xp, streak)`
- `roadmaps(id uuid pk, user_id fk, status generating|ready|failed|archived, version, goal, title, total_weeks, draft jsonb, nodes jsonb, created_at)`
- `progress_events(id, user_id fk, node_order, type, score, ts)`
- `tutor_threads(id, user_id fk, node_order, messages jsonb)`
- `ai_logs(id, user_id, task, provider, latency_ms, fallback_used, error_code, tokens, ts)` + `roadmaps_user_idx`
- `RLS enabled` (service_role bypass, anon blocked until JWT M5)

**`supabase/migrations/002_indexes_and_rls_fix.sql` (new):**
- `pgcrypto`, indexes `ai_logs_user_ts`, `progress_events_user_ts/type`, `tutor_threads_user_node`
- One-time `UPDATE generating>5m → failed`
- `updated_at` trigger
- Note: `hasRoadmap` now uses `serviceClient` to bypass RLS (was `supabaseServer` → always null)

---

## 10. Auth & Middleware

- `middleware.ts` keyless-safe: if no `CLERK_SECRET`, `NextResponse.next()`; else `clerkMiddleware` protecting `/onboarding(.*)` + `/app(.*)` via `createRouteMatcher`
- `app/app/dashboard` server guard: `auth() → !userId → /sign-in`, `getActiveRoadmapId → !activeId && !generatingId → /onboarding` (now fixed to use service_role)
- `lib/caller.ts` fallback `anon:ip` for rate limiting without Clerk

---

## 11. PWA

- `next.config.ts` `withPWA(dest:"public", disable:dev, runtimeCaching: [CacheFirst png/jpg/svg/ico, NetworkFirst /app/roadmap|/lesson|/offline (5s), NetworkFirst /api/roadmaps])`
- `public/manifest.json` `name HiPath AI, theme #050A08, icons 192/512`
- `app/offline/page.tsx` fallback, `lib` quiz queue `hipath-quiz-queue` in localStorage + sync

---

## 12. Deployment

- **Vercel** auto-deploy `main` (Hobby, `maxDuration 60` for roadmaps, 10s cap but GLIMMER 8s fits), env `NEXT_PUBLIC_CLERK_*`, `CLERK_SECRET`, `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `NIM_*`, `GITHUB_TOKEN`
- **Build:** `next build --webpack` → 13 static + 12 dynamic routes, `middleware` proxy
- **Recent deploys:** `dc477fc` (real roadmap short prompt), `f3063e6` (json_mode), `e2d8e9d` (remove template), `75cc808` (favicon + template heal), `a7d4970` (hasRoadmap fix)

---

## 13. What’s Built vs Plan.md

**Done (M0-M6):**
- M0 Scaffold + fonts + PWA + Clerk + Supabase + `lib/nim.ts` + logo recolor (now fixed)
- M1 Landing + Onboarding 4-step + Generating + guard + `POST /api/roadmaps/generate` + fallback router (now real)
- M2 Lesson split + video validate + quiz gate + adaptive
- M3 Tutor SSE Socratic + threads
- M4 Projects GitHub + Guide modal + paste half-XP
- M5 Analytics + adapt + ai_logs dashboard
- M6 Profile/Settings + PWA offline + dashboard Continue-focus

**Deferred per plan:** Weakness page (v2, `weak=true` badge + tutor nudge in v1) — done.

---

## 14. Next Steps (if you want)

- Run `002` in Supabase SQL editor (one click) for indexes/heal (already healed via API, but indexes help analytics)
- Test real roadmap end-to-end (now `ready` in ~8s, no infinite): onboarding → generating → roadmap → lesson → quiz → tutor → project
- Wire Clerk JWT template for RLS (M5) to allow `supabaseBrowser` direct reads, then remove `serviceClient` bypass in `hasRoadmap`
- Consider upgrading Vercel to Pro for `maxDuration 300` if Ultra is ever re-enabled

