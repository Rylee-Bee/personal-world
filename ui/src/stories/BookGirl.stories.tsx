import type { Meta, StoryObj } from "@storybook/react";
import { BookGirl } from "../components/bookgirl/BookGirl";

/** Book Girl's three poses: flying (glows; bobs only where motion is
 *  allowed), resting (landed, wings folded), settled (ignored, faint). */
const meta: Meta<typeof BookGirl> = {
  title: "Characters/Book Girl",
  component: BookGirl,
  tags: ["autodocs"],
  args: { size: 96 },
};

export default meta;
type Story = StoryObj<typeof BookGirl>;

export const Flying: Story = { args: { pose: "flying" } };
export const Resting: Story = { args: { pose: "resting" } };
export const Settled: Story = { args: { pose: "settled" } };
