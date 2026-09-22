import type { Meta, StoryObj } from "@storybook/react";
import { QueryProvider } from "../app/QueryProvider";
import { VaultTool } from "../screens/Vault/Vault";

/**
 * VaultTool — secrets and provider-configuration tool.
 *
 * Since the navigation re-cut this is an EMBEDDED section (it renders
 * its own region, not a <main>): Settings mounts it under "Advanced"
 * per docs/PRODUCT-LANGUAGE.md — Vault is security infrastructure,
 * rarely user-facing. The stories render it standalone for review.
 *
 * MSW handlers provide reproducible API states.
 * Switch between stories to see: locked, unlocked with secrets, unlocked empty.
 */

const meta: Meta<typeof VaultTool> = {
  title: "Screens/Settings/VaultTool",
  component: VaultTool,
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
type Story = StoryObj<typeof VaultTool>;

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
