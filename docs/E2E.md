# End-to-end tests

P2-7 of the 2026-11-13 audit. Playwright specs for the behaviour that actually
broke in production, so the next regression arrives as a red check instead of a
user report.

## What is covered

`e2e/public.spec.ts` — anonymous, no credentials, runs everywhere:

| Spec | Guards |
| --- | --- |
| home renders, no `nonce-` in CSP | the P2-4 rollout that blocked every script on a prerendered page |
| pricing shows the waitlist form | the Pro waitlist 401 regression |
| catalogue loads (needs data) | public roadmap listing |
| unknown path → 404, no `nonce-` | segment matching not swallowing dead URLs |
| `/roadmap`, `/dashboard`, `/tutor`, `/settings`, `/review` → 307 to `/sign-in` | auth gate |
| `/api/health` is public | middleware default-deny not overreaching |
| `/api/roadmaps/status/...` → 401 | default-deny still on |
| `POST /api/pricing/waitlist` with a bad email → 400 | public handler reachable; validation happens before the rate limiter, so the test consumes no quota |

`e2e/authenticated.spec.ts` — needs a Clerk session:

- `/roadmap` hydrates under the compatible policy with **zero** CSP console
  messages,
- the lesson page's header nonce equals the nonce the browser actually accepted,
  `script-src` has no `'unsafe-inline'`, `window.Clerk` loads, and no CSP
  violations appear.

The nonce equality assertion is the important one: the failure mode that shipped
was "header has a nonce, HTML has none", which a mere `script[nonce]` count
would not catch.

## Running

Against production (what CI runs):

```bash
npm run test:e2e:prod
```

Against a local build. The publishable key is inlined at build time, so it must
be the real (public) one — a fake key renders server-side HTML but every page
crashes on hydration. The secret is a dummy: nothing is authenticated.

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuaGlwYXRoYWkubWUk \
CLERK_SECRET_KEY=sk_test_dummy0000000000000000000000 \
npm run build
npm run test:e2e        # playwright.config.ts starts the server on 3100
```

`E2E_BASE_URL` points the suite at any running deployment:

```bash
E2E_BASE_URL=https://hipathai-<hash>-hirdendra1.vercel.app npx playwright test e2e/public.spec.ts
```

A local build has no database, so the catalogue spec is skipped unless
`E2E_HAS_CONTENT=1` (as `test:e2e:prod` sets).

## Authenticated runs

CI cannot sign in — that needs real credentials, and creating test users is not
something this project does automatically. Record a session once and point the
suite at it:

```bash
npx playwright codegen --save-storage=.auth/dogfood.json https://www.hipathai.me/sign-in
# sign in in the window, close it, then:
E2E_STORAGE_STATE=.auth/dogfood.json E2E_BASE_URL=https://www.hipathai.me \
  npx playwright test e2e/authenticated.spec.ts
```

`.auth/` is gitignored. The specs skip themselves when `E2E_STORAGE_STATE` is
unset, so CI stays green without a session.

Treat that file like a password: it is a live Clerk session. Re-record it when
it expires rather than adding it to CI secrets.

## CI

`.github/workflows/ci.yml`:

- `checks`: lint, typecheck, unit tests, migration filename check, **build**
  (added here — a build break used to reach Vercel before CI noticed),
- `e2e`: installs Chromium and runs the public specs against
  `https://www.hipathai.me`.

The E2E job runs after the push has deployed (GitHub integration), so it is a
production smoke test rather than a pre-merge gate. That trade is deliberate:
the alternative — a local server in CI — cannot exercise Clerk, Supabase or the
catalogue, so it would pass while production is broken.

## Conventions

- No test may write production data. The only POST is rejected by validation.
- Assert on status codes and headers with `request`; use `page` only when the
  rendering itself is the subject.
- A new app route that renders untrusted content should get a strict-CSP spec
  here, not just a unit test on the policy string.
