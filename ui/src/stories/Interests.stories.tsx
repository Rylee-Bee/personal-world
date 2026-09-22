import type { Meta, StoryObj } from "@storybook/react";
import { QueryProvider } from "../app/QueryProvider";
import { Interests } from "../screens/Interests/Interests";

/**
 * Interests — engine finds with provenance (C3) and the three honest
 * empties (C4).
 *
 * Each story mounts its own stateful MSW set (createHandlers), so the
 * "Check sources now" button behaves like the real engine inside
 * Storybook: finds appear only when the reader asks.
 */

const meta: Meta<typeof Interests> = {
  title: "Screens/Interests",
  component: Interests,
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
type Story = StoryObj<typeof Interests>;

export const Populated: Story = {
  name: "Populated — one enabled source, engine finds on check",
  parameters: {
    msw: { handlers: { interestsPopulated: true } },
  },
};

export const NothingCapturedYet: Story = {
  name: "Empty (honest) — no discovery sources exist yet",
  parameters: {
    msw: { handlers: { interestsNoSources: true } },
  },
};

export const CaptureOff: Story = {
  name: "Empty (honest) — sources configured, all switched off",
  parameters: {
    msw: { handlers: { interestsCaptureOff: true } },
  },
};

export const NothingMatched: Story = {
  name: "Empty (honest) — check runs, nothing new matches",
  parameters: {
    msw: { handlers: { interestsNothingMatched: true } },
  },
};
