# HiPath AI — Technical Requirements Document (TRD)

## Stack
- Next.js 15 (App Router), React 19, TypeScript
- Clerk auth
- Supabase Postgres
- NVIDIA NIMs for AI
- Inngest background jobs
- Tailwind v4

## Architecture
- Client paints from localStorage, reconciles with Supabase.
- Server identity comes from Clerk session.
- AI calls are feature-routed with fallback models.
- Roadmap/lesson generation runs in Inngest to bypass Vercel limits.

## Requirements
- Strict TypeScript and ESLint
- RLS on all user data
- Rate limiting per user
- Validated AI output
- Graceful fallbacks for timeouts/failures

## Performance
- Roadmap generation under 30 minutes for 20-week goals
- Lesson generation under 2 minutes
- Tutor responses under 30 seconds

## Security
- No client-trusted identity
- Service-role access only on server
- Deny-all RLS for async jobs and rate limits
