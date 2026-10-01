import { defineConfig } from "@playwright/test";

/**
 * Front-door UI against the REAL read API (`python -m personal_world.worlds.dev`, seeded reference
 * provider) through the Vite dev proxy. No mocks. Use 127.0.0.1, never localhost: TrustedHost is strict.
 */
const UI = 4181;
const API = 8765;
export default defineConfig({
  testDir: "./e2e-fd-live",
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${UI}` },
  projects: [
    { name: "phone-390", use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: "desktop-1280", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: [
    { command: "cd .. && uv run python -m personal_world.worlds.dev", url: `http://127.0.0.1:${API}/api/boards/home`, reuseExistingServer: !process.env.CI, timeout: 60_000 },
    { command: `npx vite --port ${UI} --strictPort --host 127.0.0.1`, url: `http://127.0.0.1:${UI}`, env: { VITE_API_PROXY_TARGET: `http://127.0.0.1:${API}` }, reuseExistingServer: !process.env.CI, timeout: 60_000 },
  ],
});
