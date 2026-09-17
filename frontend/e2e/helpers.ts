/**
 * Station e2e helpers.
 *
 * The seeded world (e2e/server.mjs) has `interests` hidden — the
 * nav-omission fixture — and PW_LAB_CLI unset so Lab is honestly
 * not_configured. `ci-token` is the valid bearer.
 */
import type { Page } from "playwright/test";

export const TOKEN = "ci-token";

/** Console/page-error collector: attach before navigation. */
export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}