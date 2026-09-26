/**
 * Chat — Conversational interface with the world's AI assistant.
 *
 * Layered across the product; can receive context from other screens.
 * Accessibility contract §2.1 (≥44px targets), §2.4 (focus ring),
 * §5.1 (keyboard), §7.1 (skip-to-content).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  useBriefing,
  useChatHistory,
  useChatProviders,
  useSendChat,
  useToneRegister,
} from "../../data/hooks";
import { CompanionFace } from "../../components/crew/CompanionFace";
import { SolMoment } from "../../components/SolMoment";
import type { ChatEntry } from "../../data/hooks";
import { chatToneCopy } from "../../language/tone";
import { WorldButton } from "../../components/WorldButton";

// ─── Local message shape ─────────────────────────────────
// The server transcript line is {ts:number, role, content, provider?}
// (ChatHistory NDJSON — ts is unix epoch SECONDS). We normalise into
// the shape this component renders.

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  ts?: number;
}

function normaliseMessages(raw: ChatEntry[] | undefined): ChatMessage[] {
  if (!raw) return [];
  return raw
    .filter((m) => typeof m.content === "string" && m.content.length > 0)
    .map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content,
      ts: m.ts,
    }));
}

// ─── Component ───────────────────────────────────────────

/** A question another screen wrote for the person ("Ask about this in
 *  Chat"): it lands in the box, unsent. `id` changes per ask. */
export interface ChatDraft {
  id: number;
  text: string;
}

export function Chat({ draft }: { draft?: ChatDraft | null } = {}) {
  const [input, setInput] = useState(draft?.text ?? "");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // An ask arrives as a fresh mount (App keys Chat by the ask), so the
  // box starts with its text; put the cursor there. Never sent for them.
  useEffect(() => {
    if (draft) inputRef.current?.focus();
  }, [draft]);

  const history = useChatHistory();
  const providers = useChatProviders();
  const sendChat = useSendChat();
  // The one voice's active tone register (TRUE-NORTH § Voice): server
  // truth from prefs, warm by default. It phrases the static copy;
  // facts, statuses, and the honest-off labels never change.
  const toneCopy = chatToneCopy(useToneRegister());
  // Who answers: the person's chosen companion (the same voice the chat
  // server resolves), the Assistant, or Worlds' plain voice when the crew
  // is off. Until the briefing arrives, Chat just says "Chat".
  const speaker = useChatSpeaker();

  const messages = normaliseMessages(history.data?.data?.entries);
  const isLoadingHistory = history.isLoading;
  const isSending = sendChat.isPending;

  // ── Auto-scroll on new messages ──────────────────────
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isSending, scrollToBottom]);

  // ── Send handler ─────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isSending) return;

    sendChat.mutate(
      {
        message: text,
        // The server caps the rolling window it replays at 6 turns.
        history: messages.slice(-6).map(({ role, content }) => ({
          role,
          content,
        })),
      },
      {
        onSuccess: () => {
          setInput("");
          // Refocus input after send
          inputRef.current?.focus();
        },
      },
    );
  }, [input, messages, isSending, sendChat]);

  // ── Keyboard: Enter sends, Shift+Enter newline ───────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // ── Retry on error ───────────────────────────────────
  const handleRetry = useCallback(() => {
    history.refetch();
  }, [history]);

  // ── Provider readout (the server picks the reasoning provider; the
  //    UI shows which one answers, it does not pretend to choose) ────
  const providerInfo = providers.data?.data;
  const activeProvider = providerInfo?.providers.find(
    (p) => p.name === providerInfo.active,
  );

  // ── Loading state ────────────────────────────────────
  if (isLoadingHistory && messages.length === 0) {
    return (
      <main
        id="main-content"
        aria-label="Chat"
        className="relative z-10 flex h-full flex-col p-[var(--pw-spacing-xl)]"
      >
        <SkipLink />
        <h1 className="text-[length:var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]">
          Chat
        </h1>
        <p className="mt-[var(--pw-spacing-xl)] text-[var(--pw-text-muted)]">
          Loading conversation…
        </p>
      </main>
    );
  }

  // ── Error state ──────────────────────────────────────
  if (history.error && messages.length === 0) {
    return (
      <main
        id="main-content"
        aria-label="Chat"
        className="relative z-10 flex h-full flex-col p-[var(--pw-spacing-xl)]"
      >
        <SkipLink />
        <h1 className="text-[length:var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]">
          Chat
        </h1>
        <p className="mt-[var(--pw-spacing-xl)] text-[var(--pw-text-secondary)]">
          Unable to load your conversation.
        </p>
        <p className="mt-1 text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          {history.error.message}
        </p>
        <div className="mt-[var(--pw-spacing-lg)]">
          <WorldButton variant="secondary" onPress={handleRetry} aria-label="Retry loading conversation">
            Retry
          </WorldButton>
        </div>
      </main>
    );
  }

  // ── Main render ──────────────────────────────────────
  return (
    <main
      id="main-content"
      aria-label="Chat"
      className="relative z-10 flex h-full flex-col"
    >
      <SkipLink />

      {/* Header: who answers here, with the provider folded away. */}
      <header className="flex flex-wrap items-center gap-[var(--pw-spacing-md)] border-b border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] px-[var(--pw-spacing-xl)] py-[var(--pw-spacing-lg)]">
        {speaker && (speaker.crewOn ? (
          <CompanionFace name={speaker.name} portrait={speaker.portrait} size="sm" />
        ) : (
          <SolMoment mood="mark" size={40} />
        ))}
        <div className="min-w-0 flex-1">
          <h1
            className="text-[length:var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-primary)]"
            style={{ fontFamily: "var(--pw-typography-font_serif, inherit)" }}
          >
            {speaker ? `Chat with ${speaker.name}` : "Chat"}
          </h1>
          {speaker?.crewOn && (
            <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
              Your companion answers here. Change who in Your crew.
            </p>
          )}
        </div>

        {providerInfo && providerInfo.providers.length > 0 && (
          <details className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
            <summary className="flex min-h-[var(--pw-targets-minimum)] cursor-pointer items-center rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] px-[var(--pw-spacing-md)] text-[var(--pw-text-primary)]">
              Technical detail
            </summary>
            <p className="pt-[var(--pw-spacing-xs)]" role="note">
              {activeProvider
                ? `Answering provider: ${activeProvider.display_name}`
                : "No AI model is connected yet, so Chat can’t answer."}
            </p>
          </details>
        )}
      </header>

      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-[var(--pw-spacing-xl)] py-[var(--pw-spacing-lg)]"
        role="log"
        aria-label="Chat messages"
      >
        {messages.length === 0 ? (
          <EmptyState copy={toneCopy.empty} />
        ) : (
          <div className="mx-auto max-w-[720px] space-y-[var(--pw-spacing-lg)]">
            {messages.map((msg, i) => (
              <MessageBubble key={`${msg.ts ?? "now"}-${i}`} message={msg} speaker={speaker} />
            ))}

            {isSending && (
              // Static words, never a typing animation.
              <div className="flex items-center gap-[var(--pw-spacing-md)]">
                {speaker?.crewOn && <CompanionFace name={speaker.name} portrait={speaker.portrait} size="sm" />}
                <p
                  className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]"
                  aria-live="polite"
                >
                  {speaker?.crewOn ? `${speaker.name} is thinking…` : toneCopy.thinking}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Send error — the degraded state is LABELED in the active tone
          (honest-off, TRUE-NORTH § Voice), and the server's exact
          reason always renders beneath the label: tone phrases, never
          softens. */}
      {sendChat.isError && (
        <div
          role="alert"
          className="border-t border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] px-[var(--pw-spacing-xl)] py-[var(--pw-spacing-md)]"
        >
          <p className="text-[length:var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]">
            {toneCopy.unavailableHeading}
          </p>
          <p className="mt-1 text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            {sendChat.error?.message || "Failed to send message."}
          </p>
          <WorldButton
            variant="ghost"
            onPress={() => sendChat.reset()}
            aria-label="Dismiss error"
            className="mt-1"
          >
            Dismiss
          </WorldButton>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] pt-[var(--pw-spacing-lg)] pb-[calc(var(--pw-spacing-lg)_+_var(--pw-safe-area-inset-bottom))] pl-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-left))] pr-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-right))]">
        <div className="mx-auto flex max-w-[720px] items-end gap-[var(--pw-spacing-md)]">
          <label className="flex min-w-0 flex-1 flex-col gap-[var(--pw-spacing-xs)]">
          <span className="text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-text-primary)]">
            Message
          </span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Message input"
            placeholder="Type a message…"
            rows={1}
            className="w-full resize-none rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-elevated)] px-[var(--pw-spacing-lg)] py-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)] placeholder:text-[var(--pw-text-muted)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
          />
          </label>
          <WorldButton
            variant="primary"
            onPress={handleSend}
            aria-label="Send message"
            isDisabled={!input.trim() || isSending}
          >
            Send
          </WorldButton>
        </div>
      </div>
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────

/** Skip-to-main-content link — first focusable element. */
function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-[var(--pw-radius-sm)] focus:bg-[var(--pw-surface-panel)] focus:px-[var(--pw-spacing-lg)] focus:py-[var(--pw-spacing-sm)] focus:text-[var(--pw-text-primary)] focus:ring-2 focus:ring-[var(--pw-accent-primary)]"
    >
      Skip to main content
    </a>
  );
}

/** Empty state when no messages exist. */
function EmptyState({ copy }: { copy: string }) {
  return (
    <div className="flex flex-1 items-center justify-center py-[var(--pw-spacing-3xl)]">
      <p className="text-center text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-muted)]">
        {copy}
      </p>
    </div>
  );
}

/** Who answers in Chat, from the briefing's per-caller resident: the
 *  chosen companion, the Assistant, or Worlds' plain voice (crew off). */
interface ChatSpeaker {
  name: string;
  portrait?: string;
  crewOn: boolean;
}

function useChatSpeaker(): ChatSpeaker | null {
  const briefing = useBriefing();
  const resident = briefing.data?.ok === true ? briefing.data.data?.keeper?.resident : undefined;
  if (!resident) return null;
  const crewOn = resident.key !== null;
  return {
    name: crewOn ? resident.name : "Worlds",
    portrait: resident.portrait ? `${import.meta.env.BASE_URL}${resident.portrait.replace(/^\//, "")}` : undefined,
    crewOn,
  };
}

/** A single chat message. The companion's face and name sit beside
 *  theirs (decoration; the name is written); yours are lamp-lit. The
 *  list itself is the live region (role="log"), so bubbles aren't. */
function MessageBubble({ message, speaker }: { message: ChatMessage; speaker: ChatSpeaker | null }) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[var(--pw-radius-md)] rounded-tr-[var(--pw-radius-sm)] border border-[var(--pw-accent-warm)] bg-[var(--pw-surface-hull)] px-[var(--pw-spacing-lg)] py-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_body)] leading-relaxed text-[var(--pw-text-primary)]">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-[var(--pw-spacing-md)]">
      {speaker?.crewOn && <CompanionFace name={speaker.name} portrait={speaker.portrait} size="sm" />}
      <div className="flex min-w-0 max-w-[85%] flex-col gap-[var(--pw-spacing-xs)]">
        {speaker && (
          <span className="text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-text-secondary)]">
            {speaker.name}
          </span>
        )}
        <div className="rounded-[var(--pw-radius-md)] rounded-tl-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] px-[var(--pw-spacing-lg)] py-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_body)] leading-relaxed text-[var(--pw-text-primary)]">
          {message.content}
        </div>
      </div>
    </div>
  );
}
