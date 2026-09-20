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
} from "../../data/hooks";
import { WorldButton } from "../../components/WorldButton";

// ─── Local message shape ─────────────────────────────────
// The API returns Record<string, never>[] — we normalise into a
// concrete shape the component can work with.

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

function normaliseMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => {
    const msg = m as Record<string, unknown>;
    return {
      role: (msg.role === "user" || msg.role === "assistant"
        ? msg.role
        : "assistant") as "user" | "assistant",
      content: typeof msg.content === "string" ? msg.content : "",
      timestamp: typeof msg.timestamp === "string" ? msg.timestamp : undefined,
    };
  });
}

// ─── Component ───────────────────────────────────────────

export function Chat() {
  const [input, setInput] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string | undefined>(
    undefined,
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const history = useChatHistory();
  const providers = useChatProviders();
  const sendChat = useSendChat();

  const messages = normaliseMessages(history.data?.messages);
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
        provider: selectedProvider,
      },
      {
        onSuccess: () => {
          setInput("");
          // Refocus input after send
          inputRef.current?.focus();
        },
      },
    );
  }, [input, selectedProvider, isSending, sendChat]);

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

  // ── Provider list (available only) ───────────────────
  const availableProviders =
    providers.data?.providers?.filter((p) => p.available) ?? [];

  // ── Loading state ────────────────────────────────────
  if (isLoadingHistory && messages.length === 0) {
    return (
      <main
        id="main-content"
        aria-label="Chat"
        className="relative z-10 flex h-full flex-col p-[var(--pw-spacing-xl)]"
      >
        <SkipLink />
        <h1 className="text-[var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]">
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
        <h1 className="text-[var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]">
          Chat
        </h1>
        <p className="mt-[var(--pw-spacing-xl)] text-[var(--pw-text-secondary)]">
          Unable to load your conversation.
        </p>
        <p className="mt-1 text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
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
        <h1 className="text-[var(--pw-typography-size_h2)] font-semibold text-[var(--pw-text-primary)]">
          Chat
        </h1>

        {availableProviders.length > 0 && (
          <ProviderSelector
            providers={availableProviders}
            selected={selectedProvider}
            onChange={setSelectedProvider}
          />
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
          <EmptyState />
        ) : (
          <div className="mx-auto max-w-[720px] space-y-[var(--pw-spacing-lg)]">
            {messages.map((msg, i) => (
              <MessageBubble key={`${msg.timestamp ?? i}-${i}`} message={msg} />
            ))}

            {isSending && (
              <p
                className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]"
                aria-live="polite"
              >
                Thinking…
              </p>
            )}
          </div>
        )}
      </div>

      {/* Send error */}
      {sendChat.isError && (
        <div
          role="alert"
          className="border-t border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] px-[var(--pw-spacing-xl)] py-[var(--pw-spacing-md)]"
        >
          <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
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
      <div className="border-t border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] px-[var(--pw-spacing-xl)] py-[var(--pw-spacing-lg)]">
        <div className="mx-auto flex max-w-[720px] items-end gap-[var(--pw-spacing-md)]">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Message input"
            placeholder="Type a message…"
            rows={1}
            className="flex-1 resize-none rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-elevated)] px-[var(--pw-spacing-lg)] py-[var(--pw-spacing-md)] text-[var(--pw-typography-size_body)] text-[var(--pw-text-primary)] placeholder:text-[var(--pw-text-muted)] focus:outline-none focus:ring-2 focus:ring-[#72b1b1]"
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
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-[var(--pw-radius-sm)] focus:bg-[var(--pw-surface-panel)] focus:px-[var(--pw-spacing-lg)] focus:py-[var(--pw-spacing-sm)] focus:text-[var(--pw-text-primary)] focus:ring-2 focus:ring-[#72b1b1]"
    >
      Skip to main content
    </a>
  );
}

/** Empty state when no messages exist. */
function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center py-[var(--pw-spacing-3xl)]">
      <p className="text-center text-[var(--pw-typography-size_body)] text-[var(--pw-text-muted)]">
        Start a conversation with your world assistant.
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
          "text-[var(--pw-typography-size_body)] leading-relaxed",
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

/** Provider selector dropdown. */
function ProviderSelector({
  providers,
  selected,
  onChange,
}: {
  providers: { id?: string; name?: string }[];
  selected: string | undefined;
  onChange: (id: string | undefined) => void;
}) {
  return (
    <label className="flex items-center gap-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
      <span className="sr-only">Chat provider</span>
      <select
        value={selected ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        aria-label="Select chat provider"
        className="rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-elevated)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] text-[var(--pw-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#72b1b1] min-h-[var(--pw-targets-minimum)]"
      >
        <option value="">Default provider</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name ?? p.id}
          </option>
        ))}
      </select>
    </label>
  );
}
