import { defineConfig, devices } from "@playwright/test"

// E2E against a running server.
//
// Default: build, then `npm start` on 3100 (what CI uses).
// `E2E_BASE_URL=https://www.hipathai.me npm run test:e2e` runs the same public
// specs against production without starting anything.
//
// Authenticated specs only run when `E2E_STORAGE_STATE` points at a Clerk
// session storage-state file (see docs/E2E.md). Without it they skip.
// The real publishable key: public by design (it ships in every page) and the
// only way anonymous pages hydrate locally. The secret is a dummy that never
// authenticates anyone — authenticated specs need E2E_STORAGE_STATE.
const LOCAL_PUBLISHABLE_KEY = "pk_live_Y2xlcmsuaGlwYXRoYWkubWUk"
const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3100"
const externalServer = !!process.env.E2E_BASE_URL

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    storageState: process.env.E2E_STORAGE_STATE || undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalServer
    ? undefined
    : {
        command: "npm start -- --port 3100",
        // Readiness must be a route that answers 2xx without a database;
        // /api/health is 503 when Supabase is absent, which Playwright treats
        // as "not up yet".
        url: "http://127.0.0.1:3100/",
        // The publishable key is inlined at build time, so the build must use
        // the same key (docs/E2E.md).
        env: {
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: LOCAL_PUBLISHABLE_KEY,
          CLERK_SECRET_KEY: "sk_test_dummy0000000000000000000000",
        },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
