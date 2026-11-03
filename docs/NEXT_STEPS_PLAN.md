# HiPath AI — Next Steps Plan (System Builder View)

## Current State
- All 40 test files / 317 tests passing.
- Typecheck and lint clean (generated `public/sw.js` removed).
- Latest commit pushed to `Main`.

## Phase 1 — Production Stabilization (Do Now)
1. **Inngest re-sync**: Set sync URL to `https://www.hipathai.me/api/inngest` (production), redeploy, verify function IDs in dashboard.
2. **Vercel production deploy**: Ensure latest commit is promoted; verify env vars for Production.
3. **DNS/email posture**: Apply SPF/DMARC/CAA per `docs/DNS_EMAIL_POSTURE.md`; verify with `dig`.
4. **Secret rotation**: Rotate Clerk/Supabase/NVIDIA/Vercel keys exposed in old `.env` files; confirm no secrets in repo.

## Phase 2 — Observability & Reliability
1. Add structured logging + error tracking (Sentry or PostHog errors).
2. Add health check endpoint `/api/health` for Vercel/Inngest.
3. Add Inngest retry/alerting thresholds; monitor job failure rates.
4. Add rate-limit metrics and cost monitoring for NIM calls.

## Phase 3 — Security Hardening
1. Move CSP to nonce-based (remove `unsafe-inline`) once Clerk inline scripts are hashed.
2. Make all AI routes fail-closed on rate-limit DB errors.
3. Add default-deny middleware for `/api/*`.
4. Run `npm audit` remediation after npm lockfile issue is resolved.

## Phase 4 — Product Growth
1. Implement transactional application of accepted roadmap replan proposals.
2. Add long-range analytics trends and retention charts.
3. Capstone V2.1 (visual editor, deterministic checks, AI feedback).
4. Tutor global memory across threads.

## Phase 5 — UX Polish
1. Fine-tune creature overlay positions and expressions.
2. Improve quiz persistence and resume UX.
3. Add onboarding progress persistence.

## Verification Checklist
- [ ] Production deploy on latest commit
- [ ] Inngest sync successful
- [ ] DNS records propagated
- [ ] Secrets rotated
- [ ] Tests green in CI
EOF