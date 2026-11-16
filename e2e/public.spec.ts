import { expect, test } from "@playwright/test"

// Anonymous behaviour. These are the regressions that actually reached
// production, expressed as tests:
//
// - the Pro waitlist answered 401 to every visitor (middleware default-deny),
// - a nonce policy was applied to prerendered pages, which blocked every script,
// - the default-deny and the auth gate must both stay on for app routes.
//
// Runs against CI's local build and, with E2E_BASE_URL, against production.

const scriptSrc = (csp: string | undefined) =>
  (csp ?? "").split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src ")) ?? ""

test.describe("public pages", () => {
  test("home renders and keeps the prerendered script policy", async ({ page, request }) => {
    const res = await request.get("/")
    expect(res.status()).toBe(200)

    // Prerendered HTML has no nonce to stamp, so it must NOT get a nonce policy.
    // If this fails, someone re-added a static route to STRICT_CSP_ROUTES and
    // every script on the page is being blocked.
    const csp = res.headers()["content-security-policy"]
    expect(scriptSrc(csp)).toContain("'unsafe-inline'")
    expect(scriptSrc(csp)).not.toContain("'nonce-")

    await page.goto("/")
    await expect(page.locator("h1").first()).toBeVisible()
    const nonced = await page.locator("script[nonce]").count()
    expect(nonced).toBe(0)
  })

  test("pricing renders the waitlist form", async ({ page, request }) => {
    expect((await request.get("/pricing")).status()).toBe(200)
    await page.goto("/pricing")
    await expect(page.locator('input[type="email"]').first()).toBeVisible()
  })

  test("public roadmap catalogue loads", async ({ page, request }) => {
    // Needs published roadmaps, which a CI build (no database) does not have.
    test.skip(!process.env.E2E_HAS_CONTENT, "Set E2E_HAS_CONTENT against an environment with data")
    expect((await request.get("/roadmaps")).status()).toBe(200)
    await page.goto("/roadmaps")
    await expect(page.locator('a[href^="/roadmaps/"]').first()).toBeVisible()
  })

  test("unknown paths 404 with a usable (non-strict) policy", async ({ request }) => {
    const res = await request.get("/this-route-does-not-exist")
    expect(res.status()).toBe(404)
    expect(scriptSrc(res.headers()["content-security-policy"])).not.toContain("'nonce-")
  })
})

test.describe("auth gates", () => {
  for (const path of ["/roadmap", "/dashboard", "/tutor", "/settings", "/review"]) {
    test(`${path} redirects anonymous visitors to sign-in`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 })
      expect(res.status()).toBe(307)
      expect(res.headers()["location"]).toContain("/sign-in")
    })
  }

  test("app routes sign in through Clerk, not a broken page", async ({ page }) => {
    await page.goto("/roadmap")
    await expect(page).toHaveURL(/\/sign-in/)
    await expect(page.locator("body")).toContainText(/sign in|continue/i)
  })
})

test.describe("api", () => {
  test("health is public", async ({ request }) => {
    const res = await request.get("/api/health")
    // 503 is a degraded dependency (no database locally), not an auth failure.
    expect([200, 503]).toContain(res.status())
    expect(res.headers()["content-type"]).toContain("application/json")
    expect((await res.json()).status).toBeTruthy()
  })

  test("unlisted api routes are denied anonymously", async ({ request }) => {
    const res = await request.get("/api/roadmaps/status/00000000-0000-0000-0000-000000000000")
    expect(res.status()).toBe(401)
  })

  test("the waitlist is reachable anonymously and validates input", async ({ request }) => {
    // The 401 regression: this must not be an auth failure. Invalid input must
    // come back as 400, proving the handler ran.
    const res = await request.post("/api/pricing/waitlist", { data: { email: "not-an-email" } })
    expect(res.status()).toBe(400)
  })
})
