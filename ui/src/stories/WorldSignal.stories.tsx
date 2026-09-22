import type { Meta, StoryObj } from "@storybook/react";
import { WorldSignal } from "../components/WorldSignal";

const meta: Meta<typeof WorldSignal> = {
  title: "Primitives/WorldSignal",
  component: WorldSignal,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof WorldSignal>;

export const GoodNews: Story = {
  args: {
    level: "good",
    title: "All systems healthy",
    description: "4 capabilities connected, nothing needs attention.",
  },
};

export const SmallUpdate: Story = {
  args: {
    level: "update",
    title: "Discovery",
    description: "Found 3 new items matching your interests.",
  },
};

export const Waiting: Story = {
  args: {
    level: "waiting",
    title: "Source Control",
    description: "2 pull requests waiting for review.",
  },
};

export const Critical: Story = {
  args: {
    level: "critical",
    title: "Vault unavailable",
    description: "Cannot reach encryption service. Secrets are safe but inaccessible.",
  },
};

// What the Overview attention cards actually show: a plain-language
// headline, with the exact wire string kept one tap away behind the
// "Technical detail" disclosure (never a bare snake_case token).
export const TranslatedAttention: Story = {
  args: {
    level: "update",
    title: "Source control needs your attention.",
    technical: "source_control: needs_attention",
  },
};
