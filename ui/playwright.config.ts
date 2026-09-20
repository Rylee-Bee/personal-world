import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for ui/e2e/*.spec.ts.
 *
 * Before this file existed the specs were unrunnable — `playwright test`
 * had no config, no baseURL, and no webServer.
 *
 * The specs run against the production PREVIEW build (`vite preview`,
 * default port 4173), so `dist/` must exist first:
 *   npm run build && npm run test:e2e
 *
 * Caveat for wave-1: the preview server proxies /api to
 * http://127.0.0.1:8000 (vite.config.ts server.proxy) and there is no
 * MSW bootstrapping in the preview bundle — without a live Station
 * backend, screens render their error states, so any assertion that
 * requires the success state (e.g. today.spec's greeting) cannot pass
 * against preview alone. Expected-red; not fixed here (ui/src is owned
 * by another workstream).
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
  webServer: {
    command: "npm run preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
