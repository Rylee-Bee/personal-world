import type { Meta, StoryObj } from "@storybook/react";
import { QueryProvider } from "../app/QueryProvider";
import { Vault } from "../screens/Vault/Vault";

/**
 * Vault — Secret and provider configuration screen.
 *
 * MSW handlers provide reproducible API states.
 * Switch between stories to see: locked, unlocked with secrets, unlocked empty.
 */

const meta: Meta<typeof Vault> = {
  title: "Screens/Vault",
  component: Vault,
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
type Story = StoryObj<typeof Vault>;

export const Locked: Story = {
  name: "Locked — Vault Sealed",
  parameters: {
    msw: {
      handlers: {
        vaultLocked: true,
      },
    },
  },
};

export const Unlocked: Story = {
  name: "Unlocked — Secrets Visible",
  parameters: {
    msw: {
      handlers: {
        vaultUnlocked: true,
      },
    },
  },
};

export const UnlockedEmpty: Story = {
  name: "Unlocked — No Secrets",
  parameters: {
    msw: {
      handlers: {
        vaultUnlockedEmpty: true,
      },
    },
  },
};
