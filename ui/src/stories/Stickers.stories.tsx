import type { Meta, StoryObj } from "@storybook/react";
import { Sticker, StickerSheet } from "../components/stickers/Sticker";
import { StickerPeel } from "../components/stickers/StickerPeel";

/** The Sticker Album's pieces, with made-up stickers and no art yet. */
const meta: Meta<typeof Sticker> = {
  title: "Stickers/Sticker",
  component: Sticker,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Sticker>;

export const AllStates: Story = {
  render: () => (
    <StickerSheet label="First steps">
      <Sticker id="first-light" name="First Light" kind="open" shine="paper" found />
      <Sticker id="pen-to-paper" name="Pen to Paper" kind="open" shine="foil" shape="tag" found />
      <Sticker id="lexicon" name="Lexicon" kind="open" shine="holo" shape="book" found />
      <Sticker id="hello-crew" name="Hello, Crew" kind="open" shine="paper" shape="star" found={false} />
      <Sticker id="pocket" name="Pocket Worlds" kind="riddle" shine="paper" found={false} />
      <Sticker id="sol-hi" name="Sol Says Hi" kind="secret" shine="holo" shape="star" found />
    </StickerSheet>
  ),
};

export const QuietLanding: StoryObj<typeof StickerPeel> = {
  render: () => <StickerPeel id="first-light" name="First Light" shine="paper" />,
};
