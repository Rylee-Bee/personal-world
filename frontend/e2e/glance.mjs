/**
 * Glance — screenshots any agent can read.
 *
 * Captures the Station's pages as served by a running server
 * (default: the dev server on :8731) and drops PNGs in
 * /tmp/opencode/glance/. Any agent with image reading can then
 * SEE the current look/feel — no daemon, no extension, no login.
 *
 * Run: cd frontend && node e2e/glance.mjs [baseURL]
 *
 * The dev server runs with PW_DEV_AUTH_BYPASS=1, so no login is
 * needed. Against the e2e seeded server (token auth), set
 * GLANCE_TOKEN=ci-token to inject the session first.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] || process.env.GLANCE_BASE || "http://192.168.2.76:8731";
const OUT = "/tmp/opencode/glance/";
mkdirSync(OUT, { recursive: true });

const PAGES = ["index", "interests", "journal", "projects", "chat", "settings"];

const token = process.env.GLANCE_TOKEN || null;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Skip first-visit onboarding so shots show the product, not the dialog.
await page.addInitScript(() => {
  try {
    localStorage.setItem("pw-onboarded", "1");
  } catch { /* about:blank */ }
});

if (token) {
  // Seeded e2e server: mint a session via the login endpoint first.
  await page.request.post(`${BASE}/api/auth/login`, { data: { token } }).catch(() => {});
}

for (const name of PAGES) {
  const file = name === "index" ? "" : `${name}.html`;
  try {
    await page.goto(`${BASE}/station/${file}`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(800); // let real-data panels settle
    await page.screenshot({ path: `${OUT}${name}.png` });
    console.log(`OK ${name}.png`);
  } catch (e) {
    console.log(`FAIL ${name}: ${e.message.split("\n")[0]}`);
  }
}

await browser.close();
console.log(`done → ${OUT}`);
