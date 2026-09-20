/**
 * WorldAssistant — Foundation for the companion assistant trigger.
 *
 * Accessibility contract §7.1–7.5:
 *   - Companion artwork is decorative (aria-hidden)
 *   - Control exposes only the semantic label: "Open World assistant"
 *   - Turning companion off removes no functionality
 */

import { WorldButton } from "./WorldButton";

interface WorldAssistantProps {
  onOpen: () => void;
  residentName?: string;
}

export function WorldAssistant({
  onOpen,
  residentName,
}: WorldAssistantProps) {
  return (
    <WorldButton
      variant="ghost"
      onPress={onOpen}
      aria-label="Open World assistant"
      className="gap-2"
    >
      <span aria-hidden="true" className="text-lg">
        🌍
      </span>
      <span className="sr-only">
        {residentName ? `Talk to ${residentName}` : "Open World assistant"}
      </span>
    </WorldButton>
  );
}
