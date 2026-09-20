/**
 * MSW Browser Setup — Storybook preview.
 *
 * Started with NO default handlers: every intercepted response must come
 * from the story's explicit parameters.msw config (see .storybook/
 * preview.tsx). Anything unmocked hits the real API (bypass), so a story
 * can never quietly show fabricated data as if it were live.
 */

import { setupWorker } from "msw/browser";

export const worker = setupWorker();
