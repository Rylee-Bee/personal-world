import type { Decorator, Preview } from "@storybook/react";

// Same CSS stack and order as src/main.tsx — Tailwind first, then
// generated tokens, then world.css so base styles win.
import "../src/index.css";
import "../src/generated/tokens.css";
import "../src/styles/world.css";

import { MswGate } from "../src/mocks/msw-gate";

/**
 * Story-level MSW wiring (no addon): a story opts in with
 *
 *   parameters: { msw: { handlers: { vaultUnlocked: true } } }
 *
 * and the gate starts the browser worker, activates exactly those
 * handler sets, and only THEN renders the story — so react-query can
 * never fetch ahead of the mocks. Unlisted endpoints bypass; there are
 * no ambient default handlers (see src/mocks/browser.ts).
 */
interface MswParams {
  msw?: { handlers?: Record<string, boolean> };
}

const withMsw: Decorator = (Story, context) => {
  const config = (context.parameters as MswParams).msw;
  const setsKey = Object.entries(config?.handlers ?? {})
    .filter(([, active]) => active)
    .map(([name]) => name)
    .join("|");

  return (
    <MswGate setsKey={setsKey}>
      <Story />
    </MswGate>
  );
};

const preview: Preview = {
  decorators: [withMsw],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  },
};

export default preview;
