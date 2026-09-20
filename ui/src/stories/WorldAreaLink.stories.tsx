import type { Meta, StoryObj } from "@storybook/react";
import { WorldAreaLink } from "../components/WorldAreaLink";
import { fn } from "@storybook/test";

const meta: Meta<typeof WorldAreaLink> = {
  title: "Primitives/WorldAreaLink",
  component: WorldAreaLink,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof WorldAreaLink>;

export const Default: Story = {
  args: {
    area: { id: "today", label: "Today", href: "/today" },
  },
};

export const Active: Story = {
  args: {
    area: { id: "systems", label: "Systems", href: "/systems" },
    isActive: true,
  },
};

export const WithOnClick: Story = {
  args: {
    area: { id: "projects", label: "Projects", href: "/projects" },
    onClick: fn(),
  },
};

export const ActiveWithOnClick: Story = {
  args: {
    area: { id: "journal", label: "Journal", href: "/journal" },
    isActive: true,
    onClick: fn(),
  },
};
