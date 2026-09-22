import type { Meta, StoryObj } from "@storybook/react";
import { QueryProvider } from "../app/QueryProvider";
import { Settings } from "../screens/Settings/Settings";

/**
 * Settings — Environment configuration screen.
 *
 * MSW handlers provide reproducible API states.
 * Default story shows all sections: Profile, Preferences, Sections, Capabilities, Brain, Theme.
 */

const meta: Meta<typeof Settings> = {
  title: "Screens/Settings",
  component: Settings,
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
type Story = StoryObj<typeof Settings>;

export const Default: Story = {
  name: "Default — All Sections",
  parameters: {
    msw: {
      handlers: {
        settingsDefault: true,
      },
    },
  },
};
