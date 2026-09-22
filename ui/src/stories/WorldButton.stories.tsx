import type { Meta, StoryObj } from "@storybook/react";
import { WorldButton } from "../components/WorldButton";

const meta: Meta<typeof WorldButton> = {
  title: "Primitives/WorldButton",
  component: WorldButton,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof WorldButton>;

export const Default: Story = {
  args: {
    children: "Secondary button",
  },
};

export const Primary: Story = {
  args: {
    variant: "primary",
    children: "Primary action",
  },
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
    children: "Ghost button",
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
    children: "Disabled button",
  },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <span aria-hidden="true">⭐</span>
        <span>Favorite</span>
      </>
    ),
  },
};

export const PrimaryWithIcon: Story = {
  args: {
    variant: "primary",
    children: (
      <>
        <span aria-hidden="true">🚀</span>
        <span>Deploy</span>
      </>
    ),
  },
};
