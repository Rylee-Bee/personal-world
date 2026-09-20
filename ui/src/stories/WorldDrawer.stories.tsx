import type { Meta, StoryObj } from "@storybook/react";
import { WorldDrawer } from "../components/WorldDrawer";
import { fn } from "@storybook/test";

const meta: Meta<typeof WorldDrawer> = {
  title: "Primitives/WorldDrawer",
  component: WorldDrawer,
  tags: ["autodocs"],
  args: {
    onClose: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof WorldDrawer>;

export const Closed: Story = {
  args: {
    isOpen: false,
    title: "Details",
    children: "This content is not visible.",
  },
};

export const Open: Story = {
  args: {
    isOpen: true,
    title: "Provenance",
    children: <p>This source was last synced 2 hours ago.</p>,
  },
};

export const WithContent: Story = {
  args: {
    isOpen: true,
    title: "Capability details",
    children: (
      <div>
        <p className="mb-4 text-[var(--pw-text-secondary)]">
          Showing detailed information for this capability.
        </p>
        <ul className="space-y-2">
          <li className="rounded bg-[var(--pw-surface-elevated)] p-2">
            Status: Healthy
          </li>
          <li className="rounded bg-[var(--pw-surface-elevated)] p-2">
            Uptime: 99.8%
          </li>
          <li className="rounded bg-[var(--pw-surface-elevated)] p-2">
            Last check: 30s ago
          </li>
        </ul>
      </div>
    ),
  },
};
