import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for ui/e2e/*.spec.ts.
 *
 * The specs run against the production PREVIEW build (`vite preview`,
 * port 4173), so `dist/` must exist first:
 *   npm run build && npm run test:e2e
 *
 * The preview bundle has no MSW (mocks are Storybook-only) and the
 * live backend on :8000 is auth-gated (401 on every data endpoint;
 * e2e must never carry a token). So Playwright boots the deterministic
 * mock API from scripts/e2e-api.mjs on 127.0.0.1:4174 and points the
 * preview proxy at it via VITE_API_PROXY_TARGET. The mock speaks the
 * REAL server contract ({ok, status, data} envelopes, JournalEvent as
 * {ts, kind, summary, provenance, …}) — it replaces the old comment
 * that declared success-state specs "expected-red"; screens must be
 * proven against their success path, not just their failure path.
 *
 * Order matters only for startup checks — both servers are health
 * probed before tests run.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "node scripts/e2e-api.mjs",
      url: "http://127.0.0.1:4174/healthz",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run preview",
      url: "http://localhost:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        // vite.config.ts reads this for the /api + /healthz proxy
        // target in preview mode (playwright's webServer env is
        // merged into the child process, not the browser).
        VITE_API_PROXY_TARGET: "http://127.0.0.1:4174",
      },
    },
  ],
});
