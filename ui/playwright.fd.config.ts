import { defineConfig } from "@playwright/test";

/**
 * Front-door UI e2e. Runs against the Vite dev server with the API mocked per test
 * from src/fd/fixtures.ts (page.route), so it needs no backend. Two viewports are
 * first-class: phone (390) and desktop (1280).
 */
const PORT = Number(process.env.PW_FD_PORT ?? 4180);
export default defineConfig({
  testDir: "./e2e-fd",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  projects: [
    { name: "phone-390", use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: "desktop-1280", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
