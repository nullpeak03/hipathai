# HiPath AI — status and next steps

**Date:** 2026-11-17. This file used to be a pre-audit phase list (317 tests,
"do now" items already shipped). It has been rewritten so it cannot contradict
the rest of `docs/`. Sequencing and product bets now live in
`docs/V2_PLAN.md`; feature-level specs stay in `docs/IMPLEMENTATION_PLAN.md`.

## Where V1 stands

- The 2026-11-13 CTO audit is closed for P0/P1/P2, with the exceptions listed
  below. `docs/CTO_AUDIT_2026-11-13.md` keeps the findings; this file records
  the current state.
- The learning loop has been exercised in production: six phase-1 lessons
  passed, mastery/review/attempt rows exist, and capstone evidence plus AI
  feedback work. Runbook: `docs/LEARNING_LOOP_DOGFOOD.md`.
- Generation runs on a model table re-probed on 2026-11-16, key-level failover
  (`NVIDIA_NIM_API_KEY_2`), a shared deadline, and per-job telemetry
  (`modelsUsed`, `durationMs`, `missingParts`). Scope limits:
  `docs/AI_FAILOVER.md`.
- The suite is 593 tests / 69 files; typecheck, lint, build and E2E run in CI on
  every push to `Main` (CI #385 green on `48ea532`).

## Open items

| Item | Why it is open | Trigger / owner |
| --- | --- | --- |
| Vendor-wide NVIDIA outage | Two keys on one vendor do not survive `integrate.api.nvidia.com` returning 5xx for everyone. Implementing it means a second provider behind `chatForFeature`. | Decision, not scheduled |
| Reviews verification (dogfood step 5) | Code shipped; `next_review_at` for the six passes is **2026-11-19**, so the page cannot be exercised earlier. | 2026-11-19 |
| Token / cost per learner | Telemetry records model, wall time, and missing parts, not tokens. Without it, dollars per activated learner is a guess. | V2 bet 2 |
| Restore drill | `db:check` and the migration ledger exist; no scratch restore has been rehearsed. | Quarterly, per `docs/MIGRATIONS.md` |
| CAA at the apex | SPF and DMARC are live. `www` inherits Vercel's CAA set, but the apex has none, and the zone is hosted at the registrar (Namecheap), not Vercel. | Registrar dashboard; records in `docs/DNS_EMAIL_POSTURE.md` |
| Vision image upload in the UI | The API path was verified with a real `image_url`; no lesson or tutor run has uploaded an image through the composer. | Next dogfood pass |

## Verification checklist

Checked against production on 2026-11-17 unless noted.

- [x] Latest `Main` deployed and aliased to `https://www.hipathai.me`
      (deploy `48ea532`, READY)
- [x] `/api/health` → `{"status":"ok","checks":{"database":"ok","env":"ok"}}`
- [x] Inngest production path exercised: lesson job `8498615b` completed in 83s
      with `modelsUsed: ["nim/nvidia/nemotron-3-ultra-550b-a55b"]`
- [x] Anonymous API access denied (`/api/me/roadmap` → 401); auth pages 200
- [x] No secrets tracked in git (`git ls-files` has no `.env*`; only a dummy
      `sk_test` value in `docs/E2E.md` and `playwright.config.ts`)
- [x] SPF and DMARC published; `www` CAA resolves to Vercel's CA set
- [ ] CAA published at the apex (registrar action)
- [ ] Restore drill rehearsed against a scratch project
- [ ] Review completion measured after 2026-11-19

## What not to do next

Do not add feature surface before the V2 bets in `docs/V2_PLAN.md` have a
metric. The V1 lesson was that a green suite did not catch broken rendered
output or a 403 on every page load; the next version is judged on retained
learners and measured cost, not on more screens.
