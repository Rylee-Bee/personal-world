/**
 * MSW Server Setup — For Storybook preview and testing.
 */

import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers.quiet);
