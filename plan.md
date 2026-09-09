# HiPath AI — Build Plan v4 (Tech-only, Full v1)

> Stack: Next.js 14 App Router + TS + Supabase (DB/Storage) + Clerk (auth) + NVIDIA NIMs + Vercel + PWA web-first
> Theme: Emerald terminal dark. Fonts: Space Grotesk + Inter + JetBrains Mono.
> Repo: `/home/hirdendra/Desktop/Hipathai` (greenfield, Node 20.20.2 verified)

## 0. Locked decisions

- Domain: tech-only (Frontend, Backend, Full-stack, AI/ML, DevOps, Mobile, DSA). No generic skills in v1.
- Auth: Clerk `Google + GitHub + Email OTP`, emerald dark appearance. Supabase for Postgres/Storage only.
- AI (exact NIM IDs):
  - `nvidia/nemotron-3-ultra-550b-a55b` — roadmap, tutor stream, project review (smart, slow)
  - `nvidia/nemotron-3.5-lightning-30b-a3b` — quiz, summaries, adapt + UNIVERSAL FALLBACK (fast/cheap)
  - `meta/muse-glimmer-30b` — lesson MD body, video curation
- Scope: Full vision v1 minus Weakness page (deferred to v2; v1 uses `weak=true` badge + tutor nudge).
- Progression: gated — only `nodes[0]` unlocked, `quiz >=70%` unlocks next. Quiz via `Generate Quiz` button, adaptive difficulty.
- Projects: NO code runner. GitHub public URL primary (full XP 200). Paste-code fallback half XP 100 + `verified:false` + `GitHub Guide` button/modal (make public, README, push steps).
- Onboarding: 4 steps, step 4 = Summary review with Edit links, then Generating page with terminal logs.
- Fallback rule: Ultra fail -> Lightning silently. Lightning fail -> Glimmer. All fail (after 3x auto-retry) -> error card + Retry Now (same id) + Back to Summary. NO fake template.
- Limits (chosen best for 100% free): 20 AI calls/user/day, 5 roadmaps/week, tutor 30 msgs/day, 2000 tokens/call, 7-day cache.
- Dashboard: Continue-focus (Resume + streak/XP + Up Next 3 + weak badges). Single active roadmap (regen archives old).
- PWA: installable, offline lessons + quiz queue. English only. Landing first, then onboarding (M1 order).

## 1. Logos (verified 2026-09-08)

Found:
- `hi-path-ai-icon-v2-lettermark.png` (129KB, navy + violet-blue H, purple ring, cyan dot)
- `hi-path-ai-logo-v2-for-light-bg.png` (95KB, dark-navy HI-PATH text, blue AI pill)

Mismatch: blue/violet vs locked emerald `#10B981`. Horizontal lockup invisible on dark bg.
Tasks (M0):
- [ ] Recolor H + AI pill to `#10B981 -> #34D399 -> #6EE7B7`, ring `#10B98160`, circle bg `#050A08`
- [ ] Export `public/logo-dark.png`, `public/icon-192.png`, `public/icon-512.png`, `public/favicon.ico` (keep light-bg originals)
- [ ] Use icon-512 for `manifest.json`, logo-dark for sidebar + landing nav

## 2. Routes + auth guard

```
/ | /sign-in | /sign-up | /onboarding | /app/generating?id= | /app/dashboard
/app/roadmap/[id] | /app/lesson/[nodeId] | /app/tutor | /app/projects/[nodeId]
/app/analytics | /app/profile | /app/settings | /api/...
```

Guard (`middleware.ts` + server `hasRoadmap()`):
- No session + `/app/*` -> `/sign-in`
- Session + 0 ready roadmaps -> `/onboarding` (also blocks `/app/dashboard` direct)
- Session + 1 ready + visit `/onboarding` -> `/app/dashboard`
- New signup -> `/onboarding` always

## 3. Onboarding + Generating spec

Draft persisted to `users.draft JSON + localStorage` (survives refresh).
1. Goal: track select + free-text goal
2. Level: Beginner/Int/Adv + stack checkboxes + hrs/day + deadline
3. Time: days/week + session 15/30/60 + style video/reading/project-first
4. Summary: card list + Edit anchors + `[Generate My Path ->]` (disabled while pending, idempotencyKey per draft)

`POST /api/roadmaps/generate` creates `roadmaps(status=generating, version=1)` then calls NIM router. Push `/app/generating?id=`.
Generating page: terminal typing logs, progress bar, skeleton cards, polls `GET /api/roadmaps/:id` every 2s. `ready -> /app/roadmap/[id]`. `generating>90s` still polls (server `maxDuration=120s`, resumes after tab close via dashboard banner). Fail -> error card (see §4).

## 4. NIM router + fallback (no template)

`lib/nim.ts` — only server entry, OpenAI-compat `https://integrate.api.nvidia.com/v1`, `NIM_API_KEY`. All outputs Zod-validated, 1 repair attempt per stage.

```
primary (task-dependent, timeout 45s Ultra / 25s Lightning / 30s Glimmer)
 -> retry same 1x on 429/5xx/timeout/invalid
 -> fallback Lightning compressed prompt (same schema, temp 0.3, max_tokens/2)
 -> retry 1x -> fallback Glimmer-30b -> retry 1x
 -> all fail = total 3 auto tries -> UI error + Retry Now (same roadmapId) + Back to Summary
```

Per task: roadmap Ultra->Lightning->Glimmer | lesson Glimmer->Lightning->Ultra | quiz Lightning->Glimmer->Ultra | tutor Ultra-stream->Lightning-stream | review Ultra->Lightning | summary Lightning->Glimmer.
UX: log line `> Ultra busy, switched to Lightning...`, `Fast mode` pill, never red crash. `ai_logs(provider, latency_ms, fallback_used, error_code, tokens)` every call.
Degraded when partial: lesson falls back to objectives + videos only; quiz falls back to 5 MCQs from headings; review falls back to checklist pass 70 (manual).

## 5. Feature contracts

- Roadmap: phases -> nodes `{id, order, type lesson|project, title, locked, status, difficulty 1-5, weak}`. Actions Struggling/Too Easy/Reorder create `version+1`, keep old for Undo.
- Lesson split 60/40: left MD + code copy + Ask Tutor; right tabs Video (validated embeds, max 3, oEmbed check) / AI Summary (Lightning) / Notes autosave. Sticky `[Generate Quiz]`.
- Quiz: 5-8 Qs MCQ + code-output, `difficulty = base + f(avgScore)`. Pass >=70 unlocks next + XP (lesson 50, quiz 100, project 200 GitHub / 100 paste). Fail sets `weak=true` + remedial tip + tutor deep-link, infinite retries.
- Tutor: Socratic system prompt (never direct answer first), context = goal + current node + last 3 fails + project feedback. SSE stream, persist `tutor_threads`.
- Projects: input GitHub URL -> fetch `README + tree` via GitHub API (5s timeout, `GITHUB_TOKEN` for 5000/hr) -> Ultra rubric `{correctness40, structure25, practice20, readme15, issues[], suggestions[]}` -> pass unlocks. Private/404 -> `Not reachable` + GitHub Guide modal + paste-code fallback (half XP). No execution.
- Analytics: streak, XP, hrs, quiz avg, completion %, skill heatmap, fallback transparency. Cron adapt: missed 3d or 2 fails -> push dates +3d, lower difficulty (Lightning rule).
- Profile/Settings: stats, goal/hours edit, regenerate (archive), export JSON, delete (Clerk+Supabase cascade), PWA install, sign-out, Diagnostics (ai_logs).
- Landing (M1 first): nav (logo-dark) + hero `> learn_to_ship()` typing + mock path + Start Free + bento + sample roadmap + tutor demo + Free-forever pricing + FAQ + footer. Grid + emerald glow.

## 6. Data model (Supabase Postgres)

```sql
users(clerk_id text pk, track text, level text, stack text[], hrs_per_day int, deadline date, days_per_week int, session_min int, style text, draft jsonb, xp int default 0, streak int default 0);
roadmaps(id uuid pk, user_id text ref users, status text, version int, goal text, nodes jsonb, created_at timestamptz);
nodes stored inside roadmaps.nodes JSONB for v1 (simpler gating); split to table in v2 if >500 nodes/user.
lessons(node_id text, roadmap_id uuid, md text, videos jsonb, summary text);
quizzes(node_id text, roadmap_id uuid, questions jsonb, attempts int, last_score int);
projects(node_id text, roadmap_id uuid, brief text, submissions jsonb); -- {github_url|pasted, scores, feedback, verified bool}
progress_events(id uuid, user_id text, node_id text, type text, score int, ts timestamptz);
tutor_threads(id uuid, user_id text, node_id text, messages jsonb);
ai_logs(id uuid, user_id text, task text, provider text, latency_ms int, fallback_used bool, error_code text, tokens int, ts timestamptz);
```

RLS: `users.clerk_id = (auth.jwt()->>'sub')` via Clerk JWT template; service-role only for webhooks (`user.created/deleted` -> upsert/cascade).

## 7. Design tokens (Emerald terminal)

```
--bg #050A08, --panel #0A120E, --border #10B98122, --primary #10B981, --primary2 #34D399,
--glow #6EE7B7, --text #E6F4ED, --muted #8BA494, --danger #F87171, --warn #FBBF24, --code #060D0A
radius 12 cards / 8 buttons, sidebar 260px, mobile bottom tabs, shadcn CSS vars.
Fonts via next/font: Space Grotesk 500/700 display, Inter 400/500 body, JetBrains Mono 400 code/logs.
```

PWA: `next-pwa`, `manifest name HiPath AI theme #050A08 icons 192/512`, runtimeCache lessons + thumbs, `/offline` fallback, IndexedDB quiz queue + sync, custom install button.

## 8. Env

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in ...
CLERK_SECRET_KEY= CLERK_WEBHOOK_SECRET=
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= SUPABASE_SERVICE_ROLE_KEY=
NIM_API_KEY= NIM_ULTRA_ID=nvidia/nemotron-3-ultra-550b-a55b NIM_LIGHTNING_ID=nvidia/nemotron-3.5-lightning-30b-a3b NIM_GLIMMER_ID=meta/muse-glimmer-30b
GITHUB_TOKEN= (optional, rate limit)
```

## 9. Milestones (M1 = Landing then Onboarding)

- M0 Scaffold: Next.js+TS+Tailwind+shadcn+fonts+PWA manifest+Clerk+Supabase+`lib/nim.ts` stub+`.env.example`+logo recolor
- M1 Landing + Onboarding + Generating + guard + `POST /api/roadmaps/generate` + fallback router live
- M2 Lesson split + videos validate + Generate Quiz gate + adapt difficulty
- M3 Tutor stream Socratic + threads
- M4 Projects GitHub fetch + rubric + Guide modal + paste half-XP
- M5 Analytics + adapt cron + ai_logs dashboard
- M6 Profile/Settings + PWA offline + Lighthouse >90 + Vercel deploy

Acceptance: gated unlock e2e, all-fail shows Retry (no template), 0 roadmaps->onboarding / 1 ready->dashboard, GitHub Guide opens, Lighthouse PWA installable, `npm run build` clean.

## 10. Risks mitigated (agreed)

1. GitHub-only -> Guide modal + paste half-XP fallback. 2. Free abuse -> caps + 7d cache + idempotency. 3. Clerk/Supabase orphan -> webhook + lazy upsert. 4. Fake videos -> oEmbed validation, drop invalid. 5. Slow Ultra/tab close -> persisted generating + resume + same-id retry.
