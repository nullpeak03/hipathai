# HiPath AI — Implementation Plan

## Phase 0: Foundations
- Contracts, migrations, tests

## Phase 1: Mastery Tracking
- Learner mastery API and lesson integration

## Phase 2: Curriculum Graph
- Skill nodes and mastery gating

## Phase 3: Adaptive Replanning
- Review proposals and approval
- Show concrete weak-topic recommendations and apply accepted roadmap revisions transactionally

## Phase 4: Assessment Intelligence
- 90% mastery tracking and remediation, separate from progression gates

## Phase 5: Personalized Tutor
- Mastery and weak-skill context

## Phase 6: Content Quality
- Validation and deduplication

## Phase 7: Learning Analytics
- Mastery and recovery analytics

## Phase 8: AI Routing
- Feature-based AI service

## Phase 9: Platform Hardening
- Rate limits, retries, concurrency

## Phase 10: UX and Rollout
- Mastery UI, review queue, settings
- Teach → Example → Practice → Quiz lesson flow with explicit learner pacing and missed-concept feedback
- A prioritized daily next action that favors due reviews, then weak-topic practice, then the next unlocked lesson
- Preview estimated workload during onboarding, then review the generated roadmap before starting the first lesson
- Show why an adaptation was suggested, let learners accept or dismiss it, and retain applied-change history
- Make the final capstone a goal-specific artifact with verifiable acceptance checks and optional, private evidence links

## V2.1: Guided Capstone Project Workspace (planned)
- Start with web-development roadmaps; derive project goals and skill requirements from the learner's roadmap.
- Use curated, tested project templates mapped to roadmap skills, with personalized requirements within each template.
- Provide a visual in-app editor and live preview for HTML, CSS, and vanilla JavaScript.
- Evaluate measurable requirements with deterministic browser checks; show each check as passed/not yet, an overall completion score, and actionable hints.
- Keep assessment optional: it must never block lesson completion or roadmap progress.
- Autosave private drafts and retain each submitted assessment snapshot with its results and feedback.
- Generate AI mentor feedback after each submission, with a limit of three AI reviews per project per day; deterministic checks remain unlimited.
- AI feedback is planned to receive the full project source. Update privacy disclosures and obtain appropriate user notice/consent before enabling this data flow.
- Design a secure isolated preview and test environment before implementation; never execute learner-supplied code on the application server without appropriate sandboxing.
- Existing private capstone evidence remains supported; this workspace extends it rather than replacing it.

## V2.2: Skill-Level Readiness Evidence
- Implemented on the dashboard and roadmap with linked per-skill evidence, dates/scores, explanations, and next steps.
- Final snapshots are saved once every lesson is passed and every phase mastery quiz is passed; current readiness remains separately computed as new evidence arrives.
- Snapshot writes are server-side and idempotent, and roadmap/user deletion cascades to stored snapshots.
- The Settings JSON export includes the current readiness report and its finalized snapshot.
- Show provisional, per-skill readiness on both the roadmap page and dashboard; keep existing lesson and phase progression gates unchanged.
- Use the labels `Not assessed`, `Learning`, `Practicing`, `Demonstrated`, and `Needs review`.
- Derive statuses deterministically from the learner's evidence across the roadmap; do not ask AI to assign mastery or readiness.
- Explicitly map quiz questions, quick checks, spaced reviews, and project requirements to roadmap skill nodes so every status can show its evidence and explanation.
- Use current authoritative quiz results, quick-check results, mastery records, pass-rate summaries, and existing capstone evidence for the MVP. Capstone summaries, URLs, and self-checks are learner-reported and must be labeled as such, not presented as verified results.
- At roadmap completion (all lessons and phase mastery quizzes passed), save an auditable readiness snapshot. Preserve it while a separate current view updates as new evidence is earned.
- The final report shows each skill's status, linked evidence with dates/scores, and actionable next steps for skills needing more work.
- Use evidence from the full roadmap with more weight on recent attempts. The initial `Demonstrated` target is a 90%+ aggregate with at least two available evidence types; do not double-count derived pass-rate/mastery summaries as independent evidence.
- Treat a missed due review or later difficulty on mapped assessments as a reason to mark a previously demonstrated skill `Needs review`.
- Project work is intended to become the primary signal as roadmap-specific project milestones are introduced in V2.1. Calibrate precise evidence-type weights against validated curricula before adopting project-dominant scoring.
- Readiness is informational and advisory only; it never blocks lesson completion, quiz access, or roadmap progression.
- Current phase-exam questions are not included in per-skill scoring because they are not individually mapped to skills. Quick-check storage contains successful first-award records, not failed-attempt history; capstone evidence is presented only as learner-reported context.
