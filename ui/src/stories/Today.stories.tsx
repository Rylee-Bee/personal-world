import type { Meta, StoryObj } from "@storybook/react";
import { QueryProvider } from "../app/QueryProvider";
import { Today } from "../screens/Today/Today";

/**
 * Today — The primary Project Worlds screen.
 *
 * MSW handlers provide reproducible API states.
 * Switch between stories to see: quiet, attention, offline, empty.
 */

const meta: Meta<typeof Today> = {
  title: "Screens/Today",
  component: Today,
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
type Story = StoryObj<typeof Today>;

export const Quiet: Story = {
  name: "Quiet Day — All Healthy",
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
  parameters: {
    msw: {
      handlers: {
        empty: true,
      },
    },
  },
};
