import type { Meta, StoryObj } from "@storybook/react";
import { ResidentPresence } from "../components/ResidentPresence";

const meta: Meta<typeof ResidentPresence> = {
  title: "Primitives/ResidentPresence",
  component: ResidentPresence,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ResidentPresence>;

export const Renai: Story = {
  args: {
    resident: {
      id: "renai",
      name: "Renai",
      role: "World Keeper",
      state: "rest",
    },
  },
};

export const Bolt: Story = {
  args: {
    resident: {
      id: "bolt",
      name: "Bolt",
      role: "Systems Analyst",
      state: "attentive",
    },
  },
};

export const Small: Story = {
  args: {
    resident: {
      id: "ratatoskr",
      name: "Ratatoskr",
      role: "Message Runner",
      state: "curious",
    },
    size: "sm",
  },
};

export const Large: Story = {
  args: {
    resident: {
      id: "renai",
      name: "Renai",
      role: "World Keeper",
      state: "engaged",
    },
    size: "lg",
  },
};
