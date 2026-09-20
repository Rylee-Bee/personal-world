#!/usr/bin/env node

/**
 * generate-api-types.mjs
 *
 * Generates TypeScript types from the Project Worlds OpenAPI spec.
 * Uses the local spec (src/generated/openapi.json) as source of truth.
 * To update the spec from a running backend, hit /openapi.json and replace it.
 *
 * Usage: node scripts/generate-api-types.mjs
 */

import { execSync } from "child_process";
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

try {
  execSync(
    `npx openapi-typescript "${specPath}" -o "${outputPath}"`,
    { cwd: resolve(__dirname, ".."), stdio: "inherit" }
  );
  console.log(`✓ Generated ${outputPath}`);
} catch (err) {
  console.error("❌ Failed to generate types:", err.message);
  process.exit(1);
}
