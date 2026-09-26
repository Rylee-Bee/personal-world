/**
 * Chat — Conversational interface with the world's AI assistant.
 *
 * Layered across the product; can receive context from other screens.
 * Accessibility contract §2.1 (≥44px targets), §2.4 (focus ring),
 * §5.1 (keyboard), §7.1 (skip-to-content).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  useChatHistory,
  useChatProviders,
  useSendChat,
  useToneRegister,
} from "../../data/hooks";
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

      {/* Header + provider selector */}
      <header className="flex items-center justify-between border-b border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] px-[var(--pw-spacing-xl)] py-[var(--pw-spacing-lg)]">
        <h1 className="text-[length:var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-primary)]">
          Chat
        </h1>

        {providerInfo && providerInfo.providers.length > 0 && (
          <p
            className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]"
            role="note"
          >
            {activeProvider
              ? `Answering provider: ${activeProvider.display_name}`
              : "No reasoning provider is healthy yet — chat will say so honestly."}
          </p>
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
              <MessageBubble key={`${msg.ts ?? "now"}-${i}`} message={msg} />
            ))}

            {isSending && (
              <p
                className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]"
                aria-live="polite"
              >
                {toneCopy.thinking}
              </p>
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
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Message input"
            placeholder="Type a message…"
            rows={1}
            className="flex-1 resize-none rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-elevated)] px-[var(--pw-spacing-lg)] py-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)] placeholder:text-[var(--pw-text-muted)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
          />
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

/** A single chat message bubble. */
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
      aria-live="polite"
    >
      <div
        className={[
          "max-w-[85%] rounded-[var(--pw-radius-md)] px-[var(--pw-spacing-lg)] py-[var(--pw-spacing-md)]",
          "text-[length:var(--pw-typography-size_body)] leading-relaxed",
          isUser
            ? "bg-[var(--pw-accent-primary)] text-[var(--pw-accent-on_primary)]"
            : "bg-[var(--pw-surface-elevated)] text-[var(--pw-text-primary)]",
        ].join(" ")}
      >
        {message.content}
      </div>
    </div>
  );
}
