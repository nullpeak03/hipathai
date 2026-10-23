# HiPath AI — Backend Schema (Essentials)

## Core Tables
- users
- roadmaps
- phases
- lessons
- progress
- quiz_attempts
- gamification
- chat_threads
- chat_messages

## V2 Tables
- learner_mastery
- skill_nodes
- replan_proposals
- roadmap_review_queue

## Supporting Tables
- async_jobs
- daily_activity
- review_schedule
- weak_topics
- weakness_insights
- phase_exam_progress
- public_roadmaps
- rate_limit_hits

## Notes
- Supabase is source of truth; localStorage is cache.
- RLS is per-user for private data.
- Service role is used for server routes.
