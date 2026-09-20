import type { Meta, StoryObj } from "@storybook/react";
import { QueryProvider } from "../app/QueryProvider";
import { Chat } from "../screens/Chat/Chat";

/**
 * Chat — Conversational interface with the world's AI assistant.
 *
 * MSW handlers provide reproducible API states.
 * Switch between stories to see: empty conversation, active chat with messages.
 */

const meta: Meta<typeof Chat> = {
  title: "Screens/Chat",
  component: Chat,
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
type Story = StoryObj<typeof Chat>;

export const Empty: Story = {
  name: "Empty — No Messages",
  parameters: {
    msw: {
      handlers: {
        chatEmpty: true,
      },
    },
  },
};

export const Populated: Story = {
  name: "Populated — Active Conversation",
  parameters: {
    msw: {
      handlers: {
        chatPopulated: true,
      },
    },
  },
};
