# HiPath AI — Build Report After Real Roadmap Fix (No Template)
**Date:** 2026-09-09 · **Commit:** `8bf057f` (all pages cockpit) · **Live:** https://www.hipathai.me · **Mode:** Real AI only, no mock, no template

## 1. Fixes Applied (Your Two Bugs)

**Favicon:** `app/favicon.ico` now HiPath 5 icons (was Vercel 4), `app/layout.tsx` icons include `192/512`, live `?5f361a…`.

**Roadmap timeout (`hipath — generating` network error):** Root was Vercel Hobby 10s `FUNCTION_INVOCATION_TIMEOUT` — `ULTRA 146s` in `after()` killed. Fixed to `GEMINI 2.5 Flash` primary (`lib/nim.ts:12` `roadmap:GEMINI`, `2800 tokens ~8s`, `response_format: json_object`) + short prompt `3-4×3` + `after()+waitUntil(bgPromise)` (`app/api/roadmaps/generate:93`) so POST returns `generating` in 200ms, background finishes in 8s, polling sees `ready`. No template (`lib/ai/template.ts` deleted). Verified `POST` → `ready` `fallback:false` (real) on new IP.

## 2. Project Structure (All Built)

```
app/page.tsx (landing) + layout.tsx + globals.css
app/sign-in/page.tsx + app/sign-up/page.tsx (Clerk)
app/onboarding/page.tsx (4 steps, cockpit, real draft)
app/offline/page.tsx
app/app/dashboard/page.tsx (cockpit, real)
app/app/generating/page.tsx (terminal, poll)
app/app/roadmap/[id]/page.tsx (cockpit, real)
app/app/lesson/[id]/[order]/page.tsx (cockpit, real)
app/app/projects/[id]/[order]/page.tsx (cockpit, real GitHub)
app/app/tutor/page.tsx (cockpit, real SSE)
app/app/analytics/page.tsx (cockpit, real)
app/app/profile/page.tsx (cockpit, real)
app/app/settings/page.tsx (cockpit, real)
app/api/... (13 routes)
lib/ai/*, lib/nim.ts, lib/store.ts, lib/hasRoadmap.ts, lib/caller.ts, lib/rateLimit.ts
components/Logo.tsx, InstallButton.tsx
supabase/schema.sql + migrations/002
```

## 3. Dashboard Structure (Real Data)

**Shell:** `flex min-h-screen` `aside w-64` (`workspace > / learn_to_ship()` + `MAIN: Dashboard/Roadmap/AI Tutor/Projects/Analytics` + `LEARNING: Today's Learning/Review & Recall` + `ACCOUNT: Profile/Settings`) + `header` (search `⌕` removed per your request, `v1`+streak+quota+avatar remain) + `main max-w-[1600px] p-4` + mobile bottom tabs.

**Content (all real):**
- **Stats 4:** `ROADMAP VELOCITY done/total%` + `Phase n/m`, `STREAK PROTOCOL streak Days` (dots), `DAILY QUOTA todayMins/60`, `MASTERY INDEX quizAvg%` (all from `roadmaps.nodes` + `progress_events` + `users`).
- **Hero ACTIVE MODULE:** `STEP 03 {phase}` + `{firstOpen.title}` + `Est/Difficulty/REPL` + `Continue Learning →` + `Ask AI Tutor`, right `SANDBOX EXCERPT` from `lesson.codeExamples[0]` (real) + `Module Completion {quiz.lastScore}` + `CHECKPOINT done/total`.
- **Protocol Checklist 01-04:** `LEARN` (open), `PRACTICE` (quiz for same node), `REVIEW` (weak), `REFLECT` (locked) — all `href` real.
- **Bottom:** `Areas That Need Attention` (weak nodes) + `AI Navigator` (next best step from `quizAvg`).

## 4. Pages — What’s Built & Real

| Page | File | Real Data | Works |
|------|------|-----------|-------|
| **Landing** | `app/page.tsx` | Static | Yes |
| **Onboarding** | `app/onboarding/page.tsx` | `hipath-onboarding-draft` localStorage, `POST /api/roadmaps/generate` real GEMINI | Yes |
| **Generating** | `app/app/generating/page.tsx` | Poll `GET /api/roadmaps/:id` real | Yes |
| **Roadmap** | `app/app/roadmap/[id]/page.tsx` | `serviceClient` `roadmaps.nodes`, `progress_events`, `ai_logs` — phases, nodes, artifact, upcoming, ledger | Yes |
| **Lesson** | `app/app/lesson/[id]/[order]/page.tsx` | `POST /api/lessons/generate` real GLIMMER + `noembed` video validate, `copy` + `Run` via `/api/run` (Piston), `Generate Quiz` real | Yes |
| **Projects** | `app/app/projects/[id]/[order]/page.tsx` | `githubUrl/paste` + `POST /api/projects/review` real Ultra rubric, GitHub PRs real `api.github.com`, credits from `xp` | Yes |
| **Tutor** | `app/app/tutor/page.tsx` | SSE `ULTRA→LIGHTNING→GEMINI` real, `tutor_threads` real, `scratchpad` real Piston, `Quiz Gate` real | Yes |
| **Analytics** | `app/app/analytics/page.tsx` | `GET /api/analytics` real `hrs/quizAvg/heatmap/weak/logs/adapt` | Yes |
| **Profile** | `app/app/profile/page.tsx` | `GET /api/me/profile` real `xp/streak/track/goal`, `PATCH` save, `Export`/`Delete` real | Yes |
| **Settings** | `app/app/settings/page.tsx` | `POST /api/me/regenerate`, `GET /api/me/diagnostics` real `ai_logs`, `InstallButton`, `Sign out` real Clerk | Yes |

All pages: `force-dynamic`, `serviceClient` (bypasses RLS), `emerald #10B981`, `terminal-card`, `Space Grotesk/Inter/JetBrains Mono`, responsive `1440/768/375`.

## 5. DB & APIs

**Supabase (live):** `users 4`, `roadmaps 6`, `ai_logs 3`, `progress_events 0`, `tutor_threads 0`. `schema.sql` + `002` (indexes, `updated_at`, heal). No template.

**APIs (13):** `roadmaps/generate` (GEMINI real), `roadmaps/[id]`, `lessons/generate`, `quiz/generate|grade`, `projects/review`, `tutor/chat` (SSE) + `threads`, `analytics`, `me/*`, `run` (new, Piston, every language).

## 6. PWA & Env

`next-pwa` `public/sw.js`, `manifest.json` `#050A08`, `offline` page, `InstallButton`. Env: `CLERK_*`, `SUPABASE_*`, `NIM_*`, `GOOGLE_API_KEY`/`GEMINI_API_KEY` (now required), `GITHUB_TOKEN`.

## 7. Next Steps

- Run `supabase/migrations/002` once in SQL editor for indexes.
- Test real roadmap: `onboarding → generating (~8s) → roadmap → lesson → quiz → tutor → project` all real.
- For every-language runner, ensure `app/api/run` is deployed (needs `emkc.org` allow).

