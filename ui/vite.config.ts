/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = import.meta.dirname;

// The Station serves UI and API same-origin in production; for dev and
// preview the API is proxied. Default target is the live backend;
// e2e overrides it (VITE_API_PROXY_TARGET) to the deterministic mock
// API in scripts/e2e-api.mjs — see playwright.config.ts.
const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8000";

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true
      },
      "/healthz": {
        target: API_TARGET,
        changeOrigin: true
      }
    }
  },
  test: {
    projects: [{
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    },
    {
      extends: true,
      test: {
        name: 'unit',
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/test/**/*.test.{ts,tsx}'],
      }
    }]
  }
});