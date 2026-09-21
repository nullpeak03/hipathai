# HiPath AI — Your Personal AI Learning Navigator

Adaptive learning platform: AI-generated roadmaps, weakness detection, smart
quizzes with spaced repetition, a context-aware AI tutor, analytics, and
streak reminders. Built with Next.js 15, Clerk, Supabase, NVIDIA NIMs, and Inngest.

## Prerequisites

- Node.js 20+ and npm
- A [Clerk](https://clerk.com) application (auth)
- A [Supabase](https://supabase.com) project (Postgres)
- An [NVIDIA NIM](https://build.nvidia.com) API key (AI; free tier works)
- An [Inngest](https://inngest.com) account (background roadmap generation)
- A [Resend](https://resend.com) API key (optional; streak-reminder emails only)

## Setup

```bash
npm install
cp .env.example .env.local
# fill in real values (see .env.example for the canonical variable names)
```

Apply the database migrations in order (`001` → `006`) via the Supabase
Dashboard SQL editor or `supabase db push`:

```
supabase/migrations/001_hipath.sql        # core tables (RLS enabled)
supabase/migrations/002_jobs.sql          # async roadmap job tracking
supabase/migrations/003_secure_rls.sql    # drops open policies, per-user RLS
supabase/migrations/004_activity.sql      # daily study activity (heatmap)
supabase/migrations/005_review_schedule.sql # spaced-repetition schedule
supabase/migrations/006_preferences.sql   # email reminder opt-out
```

Configure Clerk:

1. Set the webhook endpoint to `/api/webhooks/clerk` and copy its signing
   secret into `CLERK_WEBHOOK_SIGNING_SECRET`.
2. (Recommended for direct DB access) add the Supabase JWT template — until
   then the browser uses service-role API routes and the anon key stays denied.
3. Use **development** keys (`pk_test_*`/`sk_test_*`) in `.env.local`.
   Production keys (`pk_live_*`) only work on your production domain —
   with live keys, sign-in/up render blank on localhost.

Run the app + background worker:

```bash
npm run dev                 # Next.js on :3000
npx inngest-cli dev         # local Inngest (roadmap generation + reminder cron)
```

## Scripts

| Command          | What it does                              |
|------------------|-------------------------------------------|
| `npm run dev`    | Start the dev server                      |
| `npm run build`  | Production build (runs lint + typecheck)  |
| `npm test`       | Vitest unit suite (`src/**/*.test.ts`)    |
| `npm run lint`   | ESLint (must be clean)                    |
| `npm run typecheck` | `tsc --noEmit` (must be clean)         |

CI (`.github/workflows/ci.yml`) runs install → lint → typecheck → tests on
every push and pull request.

## Architecture

- `src/app` — App Router pages + API routes. Client pages paint from
  `localStorage` cache, then reconcile with Supabase (source of truth).
- `src/app/api/me/*` — service-role endpoints; identity always comes from the
  server session, never client params. The browser anon key is RLS-denied.
- `src/lib/inngest` — `generate-roadmap` + `generate-lesson` events (AI via
  per-feature routing with Gemini fallback, bulk/idempotent writes) and the
  daily `streak-reminder` cron.
- `src/lib` — pure, unit-tested modules: prompts, quiz validation, spaced
  repetition (`review.ts`), gamification math, Supabase row mappers.
- `supabase/migrations` — ordered SQL; never edit an applied migration,
  always add a new one.

## Data model (essentials)

`users` → `roadmaps` → `phases` → `lessons`; per-user `progress`,
`quiz_attempts`, `weak_topics`, `review_schedule`, `daily_activity`,
`gamification`; tutor history in `chat_threads` → `chat_messages`;
`async_jobs` tracks Inngest roadmap generation.

## Production checklist

- **Env**: all `.env.example` canonical vars set for Production (Clerk,
  Supabase URL + anon + service-role, Gemini keys, Inngest keys, optional
  Resend + PostHog). Redeploy after any env change.
- **Migrations**: applied in order via Supabase dashboard; never edit an
  applied file. Enable Point-in-Time Recovery on the project for backups.
- **Inngest**: after every deploy that touches `src/lib/inngest/**` (or its
  imports), re-sync the app in the Inngest dashboard (or install the Vercel
  integration for auto-sync). Verify function count matches the serve route.
- **Rate limits**: per-user hourly budgets in `src/lib/rate-limit.ts`
  (roadmap 5, lesson 10, quiz/weakness 30, tutor 60). 429s carry
  `Retry-After`; adjust tiers with usage data.
- **AI costs**: roadmap/lesson jobs are the expensive path (up to ~11k
  tokens); monitor provider dashboards weekly. Model IDs are env-overridable
  (`NIM_*_MODEL`, `GEMINI_MODEL`) without code changes.
- **Analytics**: PostHog pageviews + funnel events (`roadmap_generation_*`,
  `quiz_passed/failed`, `lesson_generated`) flow when `NEXT_PUBLIC_POSTHOG_*`
  are set; otherwise the app runs untracked.
- **Smoke test after deploy**: landing loads → sign in → onboarding →
  generate roadmap (completes <10 min) → open lesson → generate lesson →
  generate quiz → tutor chat → fail a quiz (weakness insight appears).
