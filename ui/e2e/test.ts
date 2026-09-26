/**
 * The e2e `test`: every spec imports it instead of @playwright/test's.
 *
 * It tags every request a test makes (the page's, `page.request`'s and
 * `request`'s) with `x-e2e-worker`, so the fixture API
 * (scripts/e2e-api.mjs) gives each Playwright worker its own world and
 * parallel specs can't reset or overwrite each other's data.
 */
import { test as base } from "@playwright/test";

export const test = base.extend({
  // Playwright's fixture callback, named so lint doesn't read it as a hook.
  extraHTTPHeaders: async ({ extraHTTPHeaders }, provide, testInfo) => {
    await provide({ ...extraHTTPHeaders, "x-e2e-worker": `w${testInfo.parallelIndex}` });
  },
});

export { expect } from "@playwright/test";
