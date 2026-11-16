import { expect, test, type Page } from "@playwright/test"

// Signed-in behaviour. Skipped unless E2E_STORAGE_STATE points at a saved Clerk
// session (see docs/E2E.md) — CI cannot sign in without credentials.
//
// These guard the P2-4 rollout that broke the app: the header carried a nonce,
// the HTML had none, and 'strict-dynamic' blocked every script. The assertion
// that matters is header nonce === HTML nonce, not merely "a nonce exists".

test.skip(
  !process.env.E2E_STORAGE_STATE,
  "Set E2E_STORAGE_STATE to run authenticated specs (docs/E2E.md)"
)

const nonceFromCsp = (csp: string) => (csp.match(/'nonce-([^']+)'/) || [])[1] ?? null

async function documentCsp(page: Page, path: string) {
  const res = await page.request.get(path)
  return { status: res.status(), csp: res.headers()["content-security-policy"] ?? "" }
}

test("roadmap page hydrates under the prerendered policy", async ({ page }) => {
  const { status, csp } = await documentCsp(page, "/roadmap")
  expect(status).toBe(200)
  expect(csp).toContain("'unsafe-inline'")
  expect(csp).not.toContain("'nonce-")

  const cspViolations: string[] = []
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) cspViolations.push(m.text())
  })

  await page.goto("/roadmap")
  await expect(page.locator("h1")).toBeVisible()
  expect(cspViolations, cspViolations.join("\n")).toEqual([])
})

test("lesson page uses a nonce that matches its HTML", async ({ page }) => {
  await page.goto("/roadmap")
  const lessonLink = page.locator('a[href*="/lesson/"]').first()
  await expect(lessonLink).toBeVisible()

  const cspViolations: string[] = []
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) cspViolations.push(m.text())
  })

  await lessonLink.click()
  await expect(page).toHaveURL(/\/lesson\//)
  await expect(page.locator("h1")).toBeVisible()

  const htmlNonces = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll<HTMLScriptElement>("script[nonce]")].map((s) => s.nonce))]
  )
  expect(htmlNonces.length).toBeGreaterThan(0)

  // The document CSP is not available from the JS context, so re-fetch the same
  // URL and compare the header with the nonce the browser actually accepted.
  const { csp } = await documentCsp(page, new URL(page.url()).pathname)
  expect(csp).toContain("'nonce-")
  expect(csp).not.toContain("'unsafe-inline'")
  expect(htmlNonces).toContain(nonceFromCsp(csp))

  // Clerk's SDK loading is what 'strict-dynamic' used to break.
  expect(await page.evaluate(() => !!(window as unknown as { Clerk?: unknown }).Clerk)).toBe(true)
  expect(cspViolations, cspViolations.join("\n")).toEqual([])
})
