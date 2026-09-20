#!/usr/bin/env node

/**
 * generate-api-types.mjs
 *
 * Generates TypeScript types from the Project Worlds OpenAPI spec.
 * Uses the local spec (src/generated/openapi.json) as source of truth.
 * The spec is hand-maintained from the server source — the deployed
 * Station disables /openapi.json (HTTP 500). See README → "Updating
 * the API Spec".
 *
 * Usage: node scripts/generate-api-types.mjs
 */

import { spawnSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const specPath = resolve(__dirname, "../src/generated/openapi.json");
const outputPath = resolve(__dirname, "../src/generated/api-types.ts");

if (!existsSync(specPath)) {
  console.error(`❌ OpenAPI spec not found at ${specPath}`);
  process.exit(1);
}

console.log(`Generating types from ${specPath}...`);

// Invoke the locally installed CLI directly. Going through `npx` added
// an npm-install round trip that emitted an `npm warn install-scripts`
// line on every build (and could resolve a remote version).
const bin = resolve(
  __dirname, "..", "node_modules", ".bin",
  `openapi-typescript${process.platform === "win32" ? ".cmd" : ""}`,
);

const result = spawnSync(bin, [specPath, "-o", outputPath], {
  stdio: "inherit",
  cwd: resolve(__dirname, ".."),
});

if (result.error || result.status !== 0) {
  console.error(
    `❌ Failed to generate types: ${result.error?.message ?? `exit ${result.status}`}`,
  );
  process.exit(1);
}
console.log(`✓ Generated ${outputPath}`);
