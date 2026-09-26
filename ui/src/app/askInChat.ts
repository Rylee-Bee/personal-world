/**
 * "Ask about this in Chat": any screen can open Chat with a question
 * already written (never sent). The person reads it, edits it if they
 * like, and sends it themselves. App provides it; a screen without a
 * provider simply doesn't offer the button.
 */
import { createContext, useContext } from "react";

export type AskInChat = (question: string) => void;

export const AskInChatContext = createContext<AskInChat | null>(null);

export function useAskInChat(): AskInChat | null {
  return useContext(AskInChatContext);
}
