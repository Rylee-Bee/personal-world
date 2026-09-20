import type { Meta, StoryObj } from "@storybook/react";
import { QueryProvider } from "../app/QueryProvider";
import { App } from "../app/App";

/**
 * App — the full shell: header readouts and footer strip derive their
 * status words from the live /healthz probe, and the nav consumes
 * /api/sections order. MSW states below let you watch those readouts
 * tell the truth: "quiet" = Online, "unreachable" = Unreachable.
 */

const meta: Meta<typeof App> = {
  title: "Screens/App",
  component: App,
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
type Story = StoryObj<typeof App>;

export const Quiet: Story = {
  name: "Quiet Day — Healthz Online",
  parameters: {
    msw: {
      handlers: {
        quiet: true,
      },
    },
  },
};

export const Unreachable: Story = {
  name: "Unreachable — Healthz Probe Failed",
  parameters: {
    msw: {
      handlers: {
        unreachable: true,
      },
    },
  },
};
