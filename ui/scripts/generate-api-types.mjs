#!/usr/bin/env node

/**
 * generate-api-types.mjs
 *
 * Generates TypeScript types from the Project Worlds OpenAPI spec.
 * Run when the backend is available:
 *   node scripts/generate-api-types.mjs
 *
 * Falls back to a minimal stub if the backend isn't reachable.
 */

import { writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, "../src/generated/api-types.ts");
const API_BASE = process.env.API_URL || "http://127.0.0.1:8000";

async function generate() {
  console.log(`Fetching OpenAPI spec from ${API_BASE}/openapi.json...`);

  try {
    const response = await fetch(`${API_BASE}/openapi.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const spec = await response.json();
    console.log(`Got spec: ${spec.info?.title} v${spec.info?.version}`);
    console.log(`Paths: ${Object.keys(spec.paths || {}).length}`);
    console.log(`Schemas: ${Object.keys(spec.components?.schemas || {}).length}`);

    // Write the raw spec for reference
    writeFileSync(
      resolve(__dirname, "../src/generated/openapi.json"),
      JSON.stringify(spec, null, 2),
    );

    // Generate a summary of available endpoints
    const endpoints = [];
    for (const [path, methods] of Object.entries(spec.paths || {})) {
      for (const method of Object.keys(methods)) {
        if (["get", "post", "put", "patch", "delete"].includes(method)) {
          endpoints.push({
            method: method.toUpperCase(),
            path,
            operationId: methods[method]?.operationId || "unknown",
            summary: methods[method]?.summary || "",
          });
        }
      }
    }

    // Write a typed client skeleton
    const clientCode = `/**
 * PROJECT WORLDS — Generated API Client
 *
 * ⚠️  THIS FILE IS GENERATED. Do not edit by hand.
 * Source: FastAPI OpenAPI spec at ${API_BASE}
 * Generator: scripts/generate-api-types.mjs
 *
 * Generated: ${new Date().toISOString()}
 * Endpoints: ${endpoints.length}
 */

import createClient from "openapi-fetch";
import type { paths } from "./openapi.json";

export const api = createClient<paths>({
  baseUrl: "${API_BASE}",
});

// Re-export the generated path types
export type { paths } from "./openapi.json";

// Endpoint catalog for reference
export const ENDPOINTS = ${JSON.stringify(endpoints, null, 2)} as const;
`;

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, clientCode, "utf-8");

    console.log(`✓ Generated ${outputPath}`);
    console.log(`✓ Generated openapi.json`);
    console.log(`  Endpoints: ${endpoints.length}`);
  } catch (err) {
    console.warn(`⚠ Could not fetch OpenAPI spec: ${err.message}`);
    console.warn("  Generating stub types instead...");

    const stub = `/**
 * PROJECT WORLDS — API Client (Stub)
 *
 * Backend not reachable at ${API_BASE}.
 * Run: node scripts/generate-api-types.mjs
 * when the backend is running to generate real types.
 */

import createClient from "openapi-fetch";

// Placeholder paths type — replace with generated types
type paths = Record<string, unknown>;

export const api = createClient<paths>({
  baseUrl: "${API_BASE}",
});

export type { paths };
export const ENDPOINTS = [] as const;
`;

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, stub, "utf-8");

    console.log(`✓ Generated stub at ${outputPath}`);
  }
}

generate();
