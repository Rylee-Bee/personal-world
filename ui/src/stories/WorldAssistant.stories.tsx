import type { Meta, StoryObj } from "@storybook/react";
import { WorldAssistant } from "../components/WorldAssistant";
import { fn } from "storybook/test";

const meta: Meta<typeof WorldAssistant> = {
  title: "Primitives/WorldAssistant",
  component: WorldAssistant,
  tags: ["autodocs"],
  args: {
    onOpen: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof WorldAssistant>;

export const Default: Story = {};

export const WithResidentName: Story = {
  args: {
    residentName: "Renai",
  },
};
