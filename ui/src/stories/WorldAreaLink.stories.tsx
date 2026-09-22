import type { Meta, StoryObj } from "@storybook/react";
import { WorldAreaLink } from "../components/WorldAreaLink";
import { fn } from "storybook/test";

/**
 * WorldAreaLink — navigation destination button.
 *
 * The shell is state-routed: activation is always the callback, and
 * destinations carry no href (the old "/today"-style URLs pointed at
 * nothing the app serves).
 */

const meta: Meta<typeof WorldAreaLink> = {
  title: "Primitives/WorldAreaLink",
  component: WorldAreaLink,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof WorldAreaLink>;

export const Default: Story = {
  args: {
    area: { id: "overview", label: "Overview" },
    onClick: fn(),
  },
};

export const Active: Story = {
  args: {
    area: { id: "memory", label: "Memory" },
    isActive: true,
    onClick: fn(),
  },
};

export const PersonalSection: Story = {
  args: {
    area: { id: "interests", label: "Interests" },
    onClick: fn(),
  },
};
