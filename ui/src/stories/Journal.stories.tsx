import type { Meta, StoryObj } from "@storybook/react";
import { QueryProvider } from "../app/QueryProvider";
import { Journal } from "../screens/Journal/Journal";

/**
 * Journal — Entry list with write, supersede, and history view.
 *
 * MSW handlers provide reproducible API states.
 * Switch between stories to see: empty journal, populated entries, history view.
 */

const meta: Meta<typeof Journal> = {
  title: "Screens/Journal",
  component: Journal,
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
type Story = StoryObj<typeof Journal>;

export const Empty: Story = {
  name: "Empty — No Journal Entries",
  parameters: {
    msw: {
      handlers: {
        journalEmpty: true,
      },
    },
  },
};

export const Populated: Story = {
  name: "Populated — Active Entries",
  parameters: {
    msw: {
      handlers: {
        journalPopulated: true,
      },
    },
  },
};
