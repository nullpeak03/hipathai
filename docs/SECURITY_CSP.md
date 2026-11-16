# Content-Security-Policy

P2-4 of the 2026-11-13 audit. `script-src` used to be
`'self' 'unsafe-inline' ...`, which makes the main XSS mitigation decorative:
any HTML injection becomes script execution.

## Two policies, chosen per route

`src/lib/csp.ts` builds one of two policies and `src/middleware.ts` picks it by
path (`requiresStrictCsp`).

| Mode | Routes | `script-src` |
| --- | --- | --- |
| strict | `/roadmap/[id]/lesson/[lessonId]`, `/start/[slug]` | `'self' 'nonce-<per-request>' 'strict-dynamic'` + Clerk origins |
| compatible | everything else — prerendered app pages, marketing, legal, auth, API | `'self' 'unsafe-inline'` + Clerk origins |

`style-src` keeps `'unsafe-inline'` in both modes: Tailwind and Clerk inject
inline styles, and CSS injection is a far smaller surface than script execution.

### Why the split exists — and why it is small

A nonce only works if the HTML contains it. Next.js reads the CSP from the
**request** headers and puts the nonce on its own inline bootstrap scripts, plus
`next/script` and Clerk's script tags — but **only for pages rendered per
request**.

The 2026-11-16 rollout learned this the hard way. The first version applied the
nonce policy to prefixes like `/roadmap` and `/tutor` on the assumption that
signed-in pages must be dynamic. They are not: they are statically prerendered
client shells (`○` in the build route table) that fetch their data from
`/api/*`. The response header carried a nonce, the HTML had none, and
`'strict-dynamic'` blocked all 36 script tags — the pages stopped hydrating.

So the strict list is matched by **segments** (not prefix) and only contains
routes the build marks `ƒ` (dynamic):

```
ƒ /roadmap/[id]/lesson/[lessonId]     lessons: generated content, quizzes, code output
ƒ /start/[slug]                       onboarding flow
```

The rest of the authenticated app (`/dashboard`, `/roadmap`, `/tutor`,
`/settings`, `/review`, `/onboarding`, `/analytics`, `/code-e`) is prerendered
and stays on the compatible policy. That is a real limit of this mitigation, not
an oversight: making those pages dynamic just to get a nonce would trade CDN
delivery for a marginal CSP gain. They render no untrusted HTML — the untrusted
content lives on the lesson page, which is dynamic and strict.

**Before adding a route:** run `npm run build` and confirm `ƒ /your-route`.
`○` (static) or `●` (SSG) means a nonce policy will break it. `csp.test.ts` pins
the current boundary, including the prerendered pages, so the mistake cannot
ship silently again.

### Sign-in is a deliberate exception

`/sign-in` and `/sign-up` are dynamic and could use a nonce, but they are
excluded on purpose: a bad script policy there locks every user out. They move
to the strict policy only after the lesson and onboarding routes have run with
nonces in production. Exit criteria: sign-in renders, Google OAuth completes,
and the Clerk script tags carry the request nonce.

## How the nonce is delivered

`src/middleware.ts`:

1. generates a 32-hex-char nonce for strict routes,
2. sets it on the **request** as `Content-Security-Policy` (Next.js extracts it)
   and as `x-nonce` (Clerk reads it),
3. sets the same policy on the response,
4. forwards the request headers through `NextResponse.next({ request })`.

Clerk's `DynamicClerkScripts` reads `X-Nonce` first, then the CSP header, and
puts the nonce on `clerk.browser.js` / UI script tags. `'strict-dynamic'` then
lets those scripts load the rest of Clerk's chunks.

## Verifying a deployment

Prerendered page — must serve the compatible policy:

```bash
curl -sI https://www.hipathai.me/roadmap | grep -i content-security-policy
# script-src 'self' 'unsafe-inline' ...
```

Strict page while signed in — the header nonce must equal the nonce on the
page's script tags:

```js
// in the browser console on the lesson page
const csp = performance.getEntriesByType("resource") // or devtools → Network → doc → headers
const nonces = new Set([...document.querySelectorAll("script[nonce]")].map(s => s.nonce))
nonces.size // 1, and it matches 'nonce-...' in the response header
```

A mismatch in the other direction (header nonce, no HTML nonce) means the route
is prerendered. Check the build route table and remove it from
`STRICT_CSP_ROUTES`.

Violations appear in the console as `Refused to load/execute ...`. Fix them by
adding the minimal origin to the specific directive (`connect-src`, `img-src`,
`frame-src`) — never by putting `'unsafe-inline'` back into `script-src`.

Segment matching also keeps the prerendered 404 page safe: a path that does not
match a strict route exactly (`/roadmap/x/lesson/y/extra`, `/start/a/b`) gets the
compatible policy, so the static not-found page still hydrates. A path that
matches but has an invalid id is 404-ed by the dynamic page itself, which gets
the nonce normally.

## Rollback

Remove the route from `STRICT_CSP_ROUTES` and redeploy. The policy falls back to
the compatible mode without touching anything else.
