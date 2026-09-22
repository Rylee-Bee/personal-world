import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { QueryProvider } from "../app/QueryProvider";
import { Overview } from "../screens/Overview/Overview";
import { SKELETON_AREAS, PERSONAL_AREAS } from "../data/types";

/**
 * Overview — the front page / headlines surface of Worlds (was
 * "Today"; docs/PRODUCT-LANGUAGE.md names the product term).
 *
 * MSW handlers provide reproducible API states.
 * Switch between stories to see: quiet, attention, offline, empty.
 * The Explore tiles are callback-driven (no router), so the stories
 * pass a spy for onOpenArea.
 */

const meta: Meta<typeof Overview> = {
  title: "Screens/Overview",
  component: Overview,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <QueryProvider>
        <Story />
      </QueryProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Overview>;

const sharedArgs = {
  areas: [...SKELETON_AREAS, ...PERSONAL_AREAS],
  onOpenArea: fn(),
  onOpenAssistant: fn(),
};

export const Quiet: Story = {
  name: "Quiet Day — All Healthy",
  args: sharedArgs,
  parameters: {
    msw: {
      handlers: {
        quiet: true,
      },
    },
  },
};

export const Waiting: Story = {
  name: "Waiting — Needs Attention",
  args: sharedArgs,
  parameters: {
    msw: {
      handlers: {
        waiting: true,
      },
    },
  },
};

export const Stale: Story = {
  name: "Stale — Capability Drift",
  args: sharedArgs,
  parameters: {
    msw: {
      handlers: {
        stale: true,
      },
    },
  },
};

export const Unavailable: Story = {
  name: "Unavailable — Service Down",
  args: sharedArgs,
  parameters: {
    msw: {
      handlers: {
        unavailable: true,
      },
    },
  },
};

export const Offline: Story = {
  name: "Offline — Nothing Connected",
  args: sharedArgs,
  parameters: {
    msw: {
      handlers: {
        offline: true,
      },
    },
  },
};

export const Empty: Story = {
  name: "Empty — Fresh Install",
  args: sharedArgs,
  parameters: {
    msw: {
      handlers: {
        empty: true,
      },
    },
  },
};
