/**
 * MSW Browser Setup — For Storybook and browser-based development.
 */

import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers.quiet);
