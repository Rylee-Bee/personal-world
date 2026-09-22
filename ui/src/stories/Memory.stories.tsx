import type { Meta, StoryObj } from "@storybook/react";
import { QueryProvider } from "../app/QueryProvider";
import { Memory } from "../screens/Memory/Memory";

/**
 * Memory — the skeleton landmark that houses the journal spine and
 * the Records section (the re-cut of the old Journal screen).
 *
 * MSW handlers provide reproducible API states.
 * Switch between stories to see: empty journal, populated entries.
 */

const meta: Meta<typeof Memory> = {
  title: "Screens/Memory",
  component: Memory,
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
type Story = StoryObj<typeof Memory>;

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
