# Content-Security-Policy

P2-4 of the 2026-11-13 audit. `script-src` used to be
`'self' 'unsafe-inline' ...`, which makes the main XSS mitigation decorative:
any HTML injection becomes script execution.

## Two policies, chosen per route

`src/lib/csp.ts` builds one of two policies, and `src/middleware.ts` picks it by
path (`requiresStrictCsp`).

| Mode | Routes | `script-src` |
| --- | --- | --- |
| strict | `/dashboard`, `/roadmap`, `/start`, `/tutor`, `/code-e`, `/analytics`, `/settings`, `/review`, `/onboarding`, `/auth` | `'self' 'nonce-<per-request>' 'strict-dynamic'` + Clerk origins |
| compatible | everything else (marketing, legal, public catalogue, API) | `'self' 'unsafe-inline'` + Clerk origins |

`style-src` keeps `'unsafe-inline'` in both modes: Tailwind and Clerk inject
inline styles, and CSS injection is a far smaller surface than script execution.

### Why the split exists

A nonce only works if the HTML contains it. Next.js reads the CSP from the
**request** headers and puts the nonce on its own inline bootstrap scripts — but
only for pages rendered per request. Marketing pages (`/`, `/pricing`,
`/roadmaps`, legal) are prerendered at build time and served from the CDN; their
HTML has no nonce, so a nonce policy would block the bootstrap and render a blank
page. Those pages contain no user data.

The strict set is an allowlist of dynamic app prefixes, so a **new** public page
defaults to the compatible policy rather than breaking silently.

### Sign-in is a deliberate exception

`/sign-in` and `/sign-up` are dynamic and could use a nonce, but they are
excluded on purpose: a bad script policy there locks every user out. They move
to the strict policy only after the app routes have run with nonces in
production. Exit criteria: sign-in renders, Google OAuth completes, and the
Clerk script tags carry the request nonce.

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

Static page — must still serve the compatible policy:

```bash
curl -sI https://www.hipathai.me/ | grep -i content-security-policy
# script-src 'self' 'unsafe-inline' ...
```

App page while signed in — header nonce must appear in the HTML:

```bash
# with a signed-in cookie jar
curl -s https://www.hipathai.me/roadmap | grep -o 'nonce="[^"]*"' | sort -u | head
```

The value must equal the `'nonce-...'` in the response header. If the header has
a nonce and the HTML has none, the route is being prerendered and must not be in
the strict list.

In the browser, a violation appears as `Refused to load/execute ...` in the
console. Fix it by adding the minimal origin to the specific directive
(`connect-src`, `img-src`, `frame-src`) — never by putting `'unsafe-inline'`
back into `script-src`.

## Rollback

Remove the route prefix from `STRICT_CSP_PREFIXES` and redeploy. The policy
falls back to the compatible mode without touching anything else.
