import { useCallback, useEffect, useRef, useState } from "react";
import { useChatProviders } from "../lib/hooks";
import {
  ApiError,
  authHeaders,
  getAuthToken,
  type ChatResult,
  type ChatJournalCorrectionProposal,
} from "../lib/api";
import { useAnnounce } from "../primitives/LiveRegion";
import { Disclosure, TechnicalDetails } from "../primitives/Disclosure";
import { StatusChip, type CanonicalStatus } from "../primitives/StatusChip";
import "./chat-screen.css";

const CONTEXT_LABELS: Record<string, string> = {
  today: "Today",
  lab: "The Lab",
  projects: "Projects",
  interests: "Interests",
  journal: "Journal & Memory",
  vault: "Vault",
  world: "World",
  settings: "Settings",
};

const CONTEXT_SUGGESTIONS: Record<string, string[]> = {
  today: [
    "What needs attention today?",
    "Anything changed since yesterday?",
    "What should I focus on?",
  ],
  lab: [
    "How are my services running?",
    "Any lab issues?",
    "What changed in the lab?",
  ],
  projects: [
    "Which project needs attention?",
    "What is the status of my repos?",
    "Any branches behind?",
  ],
  interests: [
    "What is new in my interests?",
    "Any discovery updates?",
    "Suggest something to explore.",
  ],
  journal: [
    "What needs attention here?",
    "What is this page about?",
    "What changed here recently?",
  ],
  vault: [
    "Is my vault healthy?",
    "How many secrets are stored?",
    "Any vault warnings?",
  ],
  world: [
    "What does my world look like?",
    "How is the world model?",
    "Any world drift?",
  ],
  settings: [
    "What can I configure?",
    "What are my current preferences?",
    "Any settings I should review?",
  ],
};

const GLOBAL_SUGGESTIONS = [
  "How is my world today?",
  "What changed today?",
  "Does anything need me?",
] as const;

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  model?: string | null;
  thinking?: string | null;
  proposal?: ChatJournalCorrectionProposal | null;
}

const HISTORY_STORAGE_PREFIX = "pw_chat_history_";
const HISTORY_MAX_TURNS = 6;

function chatTokenScope(token: string): string {
  let first = 2166136261;
  let second = 2246822507;
  for (let index = 0; index < token.length; index += 1) {
    const code = token.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 2246822507);
  }
  return (
    (first >>> 0).toString(16).padStart(8, "0") +
    (second >>> 0).toString(16).padStart(8, "0")
  );
}

function historyStorageKey(): string {
  return `${HISTORY_STORAGE_PREFIX}${chatTokenScope(getAuthToken())}`;
}

function loadStoredHistory(): ChatTurn[] {
  try {
    const raw = sessionStorage.getItem(historyStorageKey());
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const turns: ChatTurn[] = [];
    for (const t of parsed) {
      if (typeof t !== "object" || t === null) continue;
      const rec = t as {
        role?: unknown;
        content?: unknown;
        source?: { model?: unknown };
      };
      if (rec.role !== "user" && rec.role !== "assistant") continue;
      if (typeof rec.content !== "string") continue;
      const model =
        typeof rec.source?.model === "string" ? rec.source.model : null;
      turns.push({ role: rec.role, content: rec.content, model });
    }
    return turns.slice(-HISTORY_MAX_TURNS);
  } catch {
    return [];
  }
}

function persistHistory(turns: ChatTurn[]): void {
  try {
    sessionStorage.setItem(
      historyStorageKey(),
      JSON.stringify(
        turns.slice(-HISTORY_MAX_TURNS).map((t) => ({
          role: t.role,
          content: t.content,
          ...(t.role === "assistant" && t.model
            ? { source: { model: t.model } }
            : {}),
        }))
      )
    );
  } catch {
    // sessionStorage may be full or blocked — conversation stays in memory.
  }
}

function statusWord(status: string | null | undefined): string {
  if (status == null) return "unknown";
  const t = String(status).toLowerCase();
  if (t === "healthy" || t === "ok") return "healthy";
  if (t === "unavailable") return "unavailable";
  if (t === "needs_attention") return "needs attention";
  if (t === "not_configured") return "not configured";
  return t;
}

const CANONICAL = new Set([
  "healthy",
  "warning",
  "unknown",
  "needs_attention",
  "unavailable",
  "stale",
  "disabled",
  "not_configured",
]);

export default function ChatScreen({ context }: { context?: string }) {
  const { announce } = useAnnounce();
  const providersQuery = useChatProviders();
  const [turns, setTurns] = useState<ChatTurn[]>(() => loadStoredHistory());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{
    text: string;
    retryText: string | null;
  } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    persistHistory(turns);
  }, [turns]);

  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    if (typeof log.scrollTo === "function") {
      log.scrollTo({ top: log.scrollHeight });
    }
  }, [turns, error, busy]);

  const send = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || busy) return;
      setTurns((prev) => [...prev, { role: "user", content: text }]);
      setInput("");
      setBusy(true);
      setError(null);
      try {
        const history = turns
          .slice(-HISTORY_MAX_TURNS)
          .map((t) => ({ role: t.role, content: t.content }));

        const messages = [
          {
            role: "system",
            content: context
              ? `The user is currently viewing the ${CONTEXT_LABELS[context] ?? context} screen of their Personal World. Tailor your responses to be contextually relevant to this area.`
              : "You are the Personal World assistant. Help the user understand and manage their world.",
          },
          ...history,
          { role: "user", content: text },
        ];

        const headers = authHeaders();

        const res = await fetch("/api/chat", {
          method: "POST",
          headers,
          body: JSON.stringify({ messages }),
        });

        if (res.status === 401) {
          setError({
            text: "Sign-in required. Your conversation is paused.",
            retryText: text,
          });
          announce("Sign-in required.", {
            kind: "error",
            key: "chat-auth",
          });
          return;
        }

        const body: ChatResult = await res.json().catch(() => null);

        if (!body || body.ok === false) {
          const word = statusWord(body?.status);
          setError({
            text:
              body?.status === "not_configured"
                ? "Conversation is not configured right now. Add a reasoning connection in Settings — your world and journal still work."
                : `Conversation is ${word} right now. Your world and journal still work.`,
            retryText: text,
          });
          announce("Conversation paused. Nothing else was interrupted.", {
            kind: "error",
            key: "chat-paused",
          });
          return;
        }

        const reply = (body.reply ?? "").trim();
        setTurns((prev) => [
          ...prev,
          {
            role: "assistant",
            content: reply || "I did not receive a readable reply.",
            model: body.model ?? null,
            thinking: body.thinking ?? null,
            proposal: body.proposal ?? null,
          },
        ]);
        announce("Reply received.", {
          kind: "action_completed",
          key: "chat-reply",
        });
      } catch (e) {
        const apiErr = e instanceof ApiError ? e : null;
        const failureText =
          apiErr && apiErr.status !== 0
            ? apiErr.detail ?? apiErr.message
            : "The conversation connection did not answer. Your world and journal still work.";
        setError({ text: failureText, retryText: text });
        announce("Conversation unavailable. Nothing else was interrupted.", {
          kind: "error",
          key: "chat-unavailable",
        });
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [announce, busy, turns, context]
  );

  const retry = useCallback(() => {
    const text = error?.retryText;
    if (!text) return;
    setTurns((prev) => {
      const next = [...prev];
      if (next.length > 0 && next[next.length - 1].role === "user") {
        next.pop();
      }
      return next;
    });
    setError(null);
    void send(text);
  }, [error, send]);

  const keepWriting = useCallback(() => {
    setError(null);
    inputRef.current?.focus();
  }, []);

  const providers = providersQuery.data;
  const providersError = providersQuery.isError
    ? providersQuery.error instanceof ApiError
      ? providersQuery.error.message
      : "Could not load provider info."
    : null;
  const activeProvider = providers?.active ?? null;
  const isEmpty = turns.length === 0 && error === null && !busy;
  const contextLabel = context ? CONTEXT_LABELS[context] ?? context : null;
  const starters = context
    ? CONTEXT_SUGGESTIONS[context] ?? [...GLOBAL_SUGGESTIONS]
    : [...GLOBAL_SUGGESTIONS];

  return (
    <div className="pw-chat-screen">
      <header className="pw-chat-screen-header">
        <div className="pw-chat-screen-header-title">
          <h1 className="pw-chat-screen-heading">
            Chat
            <span aria-hidden="true" className="pw-chat-screen-spark">✦</span>
          </h1>
          {contextLabel ? (
            <p className="pw-chat-screen-context-badge">
              <span className="pw-chat-screen-context-dot" aria-hidden="true" />
              {contextLabel}
            </p>
          ) : null}
        </div>
        <div className="pw-chat-screen-provider" role="status" aria-label="Active provider">
          {providersError ? (
            <span className="pw-chat-screen-provider-status pw-chat-screen-provider-status--error">
              Provider unavailable
            </span>
          ) : activeProvider ? (
            <span className="pw-chat-screen-provider-status pw-chat-screen-provider-status--ok">
              <span className="pw-chat-screen-provider-dot" aria-hidden="true" />
              {activeProvider}
            </span>
          ) : providers ? (
            <span className="pw-chat-screen-provider-status pw-chat-screen-provider-status--none">
              No provider configured
            </span>
          ) : (
            <span className="pw-chat-screen-provider-status pw-chat-screen-provider-status--loading">
              Checking provider…
            </span>
          )}
          {providers && providers.providers.length > 0 ? (
            <Disclosure summary="All providers" level={2}>
              <ul className="pw-chat-screen-provider-list">
                {providers.providers.map((p) => (
                  <li key={p.name}>
                    {p.display_name}{" "}
                    <StatusChip
                      status={
                        CANONICAL.has(p.status)
                          ? (p.status as CanonicalStatus)
                          : "unknown"
                      }
                      size="sm"
                    />
                  </li>
                ))}
              </ul>
            </Disclosure>
          ) : null}
        </div>
      </header>

      {contextLabel ? (
        <p className="pw-chat-screen-context-line">
          You opened this from <strong>{contextLabel}</strong> — questions
          about &ldquo;here&rdquo; mean that page.
        </p>
      ) : null}

      <div
        ref={logRef}
        className="pw-chat-screen-log"
        role="log"
        aria-label="Conversation"
        aria-live="off"
      >
        {isEmpty ? (
          <div className="pw-chat-screen-empty">
            <div className="pw-chat-screen-empty-icon" aria-hidden="true">
              <span className="pw-chat-screen-empty-glow" />
              <span className="pw-chat-screen-empty-star">✦</span>
            </div>
            <p className="pw-chat-screen-empty-text">
              {contextLabel
                ? `Ask about ${contextLabel.toLowerCase()} — health, changes, what needs attention here.`
                : "Ask about your world — health, changes, what needs attention."}
            </p>
            <div
              className="pw-chat-screen-starters"
              role="group"
              aria-label="Conversation starters"
            >
              {starters.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="pw-chat-screen-chip"
                  onClick={() => void send(s)}
                  disabled={busy}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {turns.map((turn, i) =>
          turn.role === "user" ? (
            <div key={`u${i}`} className="pw-chat-screen-msg pw-chat-screen-msg--user">
              <p>{turn.content}</p>
            </div>
          ) : (
            <div key={`a${i}`} className="pw-chat-screen-msg pw-chat-screen-msg--assistant">
              <div className="pw-chat-screen-reply-blocks">
                {turn.content
                  .split(/\n{2,}/)
                  .filter((para) => para.trim().length > 0)
                  .map((para, pi) => (
                    <div key={pi} className="pw-chat-screen-companion-msg">
                      <span
                        aria-hidden="true"
                        className="pw-chat-screen-companion-star"
                      >
                        ✦
                      </span>
                      <div className="pw-chat-screen-companion-body">
                        <p>{para}</p>
                      </div>
                    </div>
                  ))}
              </div>
              {turn.thinking ? (
                <details className="pw-chat-screen-thinking-details">
                  <summary className="pw-chat-screen-thinking-summary">
                    Reasoning
                    <span
                      aria-hidden="true"
                      className="pw-chat-screen-thinking-stars"
                    >
                      <span className="pw-chat-screen-star-1">✦</span>
                      <span className="pw-chat-screen-star-2">✦</span>
                      <span className="pw-chat-screen-star-3">✦</span>
                    </span>
                  </summary>
                  <div className="pw-chat-screen-thinking-content">
                    <p>{turn.thinking}</p>
                  </div>
                </details>
              ) : null}
              <Disclosure summary="Sources" level={3}>
                <p className="pw-chat-screen-based-on">
                  <span
                    aria-hidden="true"
                    className="pw-chat-screen-companion-star"
                  >
                    ✦
                  </span>{" "}
                  Based on: Project Worlds snapshot
                </p>
                <p>Read-only Project Worlds snapshot</p>
                {turn.model ? (
                  <p>Conversation model: {turn.model}</p>
                ) : null}
                {turn.thinking ? (
                  <TechnicalDetails
                    provider={turn.model ?? undefined}
                    raw={turn.thinking}
                  />
                ) : null}
              </Disclosure>
            </div>
          )
        )}

        {busy ? (
          <div
            className="pw-chat-screen-msg pw-chat-screen-msg--assistant"
            data-pw-thinking=""
          >
            <p className="pw-chat-screen-thinking">
              Thinking{" "}
              <span aria-hidden="true" className="pw-chat-screen-thinking-stars">
                <span className="pw-chat-screen-star-1">✦</span>
                <span className="pw-chat-screen-star-2">✦</span>
                <span className="pw-chat-screen-star-3">✦</span>
              </span>
            </p>
          </div>
        ) : null}

        {error ? (
          <div
            className="pw-chat-screen-msg pw-chat-screen-msg--error"
            data-pw-chat-error=""
          >
            <p>{error.text}</p>
            <div className="pw-chat-screen-actions">
              {error.retryText ? (
                <button
                  type="button"
                  className="pw-chat-screen-chip"
                  onClick={retry}
                >
                  Retry
                </button>
              ) : null}
              <button
                type="button"
                className="pw-chat-screen-chip"
                onClick={keepWriting}
              >
                Keep writing
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <form
        className="pw-chat-screen-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <textarea
          ref={inputRef}
          className="pw-chat-screen-input"
          aria-label="Message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          rows={2}
          disabled={busy}
          placeholder={
            contextLabel
              ? `Ask about ${contextLabel.toLowerCase()}…`
              : "Ask about your world…"
          }
        />
        <button
          type="submit"
          className="pw-chat-screen-send"
          disabled={busy || !input.trim()}
          aria-label="Send"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22 11 13 2 9z" />
          </svg>
        </button>
      </form>

      <footer className="pw-chat-screen-footer">
        <p>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3l1.912 5.813h6.124l-4.962 3.574 1.912 5.813L12 14.626 7.014 18.2l1.912-5.813L3.964 8.813h6.124z" />
          </svg>{" "}
          Powered by your Project Worlds
        </p>
      </footer>
    </div>
  );
}
