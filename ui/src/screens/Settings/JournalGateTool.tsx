/**
 * JournalGateTool — Settings/Advanced view of the journal gate
 * (journal_gate.py, api.py journal_gate_*, owner design 2026-09-27).
 *
 * The gate is a closed-enum-only door onto the private Journal for
 * agents holding the "journal_gate" scope. This tool is the person's
 * own visibility and control over it, same "rarely needs a direct
 * visit, kept reachable anyway" placement as VaultTool:
 *
 *   - which agents currently hold the scope, with a revoke action
 *     (reuses the existing agents list/disable endpoints — no new
 *     backend for this part)
 *   - the audit log: who asked what, when, and what they got back —
 *     never raw journal entries, the server only ever stores/returns
 *     the same closed enum the agent itself receives
 *   - the owner's own "never answer about..." denylist (topics and/or
 *     specific agents that always get "unsure", checked before any
 *     retrieval or model call)
 *
 * Revoke confirmation is a native <dialog> with showModal(), same
 * pattern as VaultTool's delete confirmation (§3.3): modal, focus
 * trapped, Escape cancels, focus returns to the invoking control.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useJournalGateAgents,
  useRevokeAgent,
  useJournalGateLog,
  useJournalGateDenylist,
  usePutJournalGateDenylist,
} from "../../data/hooks";
import { describeError } from "../../data/errors";
import { WorldButton } from "../../components/WorldButton";
import type { JournalGateDenylist } from "../../data/contract";

const BTN_CORAL =
  "inline-flex items-center justify-center rounded-[var(--pw-radius-sm)] font-medium " +
  "transition-colors duration-150 motion-reduce:transition-none " +
  "min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] " +
  "px-[var(--pw-spacing-lg)] py-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] " +
  "bg-[var(--pw-accent-coral)] text-[var(--pw-surface-void)] hover:brightness-110 active:brightness-90 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const TEXTAREA_BASE =
  "w-full rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] " +
  "px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] " +
  "text-[var(--pw-text-primary)] min-h-[calc(var(--pw-targets-minimum)_*_2)] " +
  "focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]";

function SaveNote({ message, tone }: { message: string; tone: "ok" | "error" }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
    >
      {message}
    </p>
  );
}

function formatWhen(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

function AgentsSection() {
  const { agents, isLoading, error } = useJournalGateAgents();
  const revoke = useRevokeAgent();
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (revokeTarget) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
      const trigger = triggerRef.current;
      triggerRef.current = null;
      trigger?.focus();
    }
  }, [revokeTarget]);

  const closeDialog = useCallback(() => setRevokeTarget(null), []);

  const confirmRevoke = useCallback(() => {
    if (!revokeTarget) return;
    revoke.mutate(revokeTarget, {
      onSuccess: () => {
        setNotice({ text: `Revoked ${revokeTarget}.`, tone: "ok" });
        closeDialog();
      },
      onError: (err) => {
        setNotice({ text: describeError(err, `Could not revoke ${revokeTarget}.`), tone: "error" });
        closeDialog();
      },
    });
  }, [revokeTarget, revoke, closeDialog]);

  return (
    <div className="mb-[var(--pw-spacing-xl)]">
      <h3 className="mb-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]">
        Agents with gate access
      </h3>
      <p className="mb-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
        Each of these can ask the gate closed yes/no questions about your
        Journal — never read it directly. Revoking one takes effect
        immediately.
      </p>
      {isLoading && (
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          Loading…
        </p>
      )}
      {error && (
        <SaveNote message={describeError(error, "Could not load agents.")} tone="error" />
      )}
      {!isLoading && !error && agents.length === 0 && (
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          No agent currently holds gate access.
        </p>
      )}
      {agents.length > 0 && (
        <ul className="space-y-[var(--pw-spacing-sm)]" role="list">
          {agents.map((a) => (
            <li
              key={a.user_id}
              className="flex items-center gap-[var(--pw-spacing-md)] p-[var(--pw-spacing-md)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)]"
            >
              <div className="flex-1">
                <div className="text-[length:var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]">
                  {a.display_name}
                </div>
                <div className="text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-secondary)]">
                  {a.user_id} · added {new Date(a.created_at * 1000).toLocaleString()}
                </div>
              </div>
              <button
                type="button"
                className={BTN_CORAL}
                onClick={(e) => {
                  triggerRef.current = e.currentTarget;
                  setRevokeTarget(a.user_id);
                }}
                aria-label={`Revoke gate access for ${a.display_name}`}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
      {notice && <SaveNote message={notice.text} tone={notice.tone} />}

      <dialog
        ref={dialogRef}
        role="alertdialog"
        aria-labelledby="revoke-dialog-title"
        aria-describedby="revoke-dialog-desc"
        onClick={(e) => {
          if (e.target === dialogRef.current) closeDialog();
        }}
        onCancel={(e) => {
          e.preventDefault();
          closeDialog();
        }}
        className="hidden open:grid fixed inset-0 z-50 m-0 h-full max-h-full w-full max-w-full place-items-center bg-black/60 pt-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-top))] pr-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-right))] pb-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-bottom))] pl-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-left))] text-[var(--pw-text-primary)]"
      >
        <div className="w-full max-w-md rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-xl)] mx-[var(--pw-spacing-xl)]">
          <h2
            id="revoke-dialog-title"
            className="text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)]"
          >
            Revoke gate access
          </h2>
          <p
            id="revoke-dialog-desc"
            className="mt-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
          >
            Are you sure you want to revoke{" "}
            <span className="font-medium text-[var(--pw-text-primary)]">{revokeTarget}</span>?
            It will get "unsure" for every future ask.
          </p>
          <div className="mt-[var(--pw-spacing-xl)] flex justify-end gap-[var(--pw-spacing-md)]">
            <WorldButton variant="secondary" onPress={closeDialog} aria-label="Cancel revoke">
              Cancel
            </WorldButton>
            <button
              type="button"
              onClick={confirmRevoke}
              disabled={revoke.isPending}
              className={BTN_CORAL}
              aria-label={`Confirm revoke ${revokeTarget ?? ""}`}
            >
              {revoke.isPending ? "Revoking…" : "Revoke"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

function LogSection() {
  const { data, isLoading, error } = useJournalGateLog({ n: 20 });
  const entries = data?.data?.entries ?? [];

  return (
    <div className="mb-[var(--pw-spacing-xl)]">
      <h3 className="mb-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]">
        Recent asks
      </h3>
      <p className="mb-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
        The last 20 questions the gate answered — never what your Journal
        actually says, only what was asked and what came back.
      </p>
      {isLoading && (
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          Loading…
        </p>
      )}
      {error && <SaveNote message={describeError(error, "Could not load the log.")} tone="error" />}
      {!isLoading && !error && entries.length === 0 && (
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          No asks yet.
        </p>
      )}
      {entries.length > 0 && (
        <ul className="space-y-[var(--pw-spacing-sm)]" role="list">
          {entries.map((e, i) => (
            <li
              key={`${e.ts}-${i}`}
              className="p-[var(--pw-spacing-md)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] text-[length:var(--pw-typography-size_small)]"
            >
              <div className="text-[var(--pw-text-primary)]">
                <span className="font-medium">{e.caller_id}</span> asked{" "}
                <span className="italic">{e.ask}</span> about "{e.topic}" →{" "}
                <span className="font-medium">{e.answer}</span>
                {e.model_mode === "mock" && (
                  <span className="ml-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-secondary)]">
                    (no model configured — word-match only)
                  </span>
                )}
              </div>
              <div className="text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-secondary)]">
                {formatWhen(e.ts)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The editable form, mounted once the current denylist is known.
 * State is lazily initialized straight from `initial` — no effect
 * needed to sync it in after the fact. `Settings` remounts this (via
 * `key`) if the server value ever changes out from under an open form. */
function DenylistForm({ initial }: { initial: JournalGateDenylist }) {
  const putDenylist = usePutJournalGateDenylist();
  const [topics, setTopics] = useState(() => initial.blocked_topics.join("\n"));
  const [agents, setAgents] = useState(() => initial.blocked_agents.join("\n"));
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  const save = useCallback(() => {
    setNotice(null);
    putDenylist.mutate(
      {
        blocked_topics: topics.split("\n").map((t) => t.trim()).filter(Boolean),
        blocked_agents: agents.split("\n").map((a) => a.trim()).filter(Boolean),
      },
      {
        onSuccess: () => setNotice({ text: "Saved.", tone: "ok" }),
        onError: (err) =>
          setNotice({ text: describeError(err, "Could not save."), tone: "error" }),
      },
    );
  }, [topics, agents, putDenylist]);

  return (
    <>
      <label className="block mb-[var(--pw-spacing-md)]">
        <span className="block mb-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-primary)]">
          Topics (one per line)
        </span>
        <textarea
          className={TEXTAREA_BASE}
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
          placeholder="e.g. medication"
        />
      </label>
      <label className="block mb-[var(--pw-spacing-md)]">
        <span className="block mb-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-primary)]">
          Agent ids (one per line)
        </span>
        <textarea
          className={TEXTAREA_BASE}
          value={agents}
          onChange={(e) => setAgents(e.target.value)}
          placeholder="e.g. agent:gatebot"
        />
      </label>
      <WorldButton variant="primary" onPress={save} isDisabled={putDenylist.isPending}>
        {putDenylist.isPending ? "Saving…" : "Save"}
      </WorldButton>
      {notice && <SaveNote message={notice.text} tone={notice.tone} />}
      <p
        className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-secondary)] italic"
        role="note"
      >
        This action requires step-up authentication
      </p>
    </>
  );
}

function DenylistSection() {
  const { data, isLoading, error } = useJournalGateDenylist();

  return (
    <div>
      <h3 className="mb-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]">
        Never answer about...
      </h3>
      <p className="mb-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
        Topics or agent ids listed here always get "unsure" — checked
        before the gate looks at anything or calls any model.
      </p>
      {isLoading && (
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          Loading…
        </p>
      )}
      {error && <SaveNote message={describeError(error, "Could not load the list.")} tone="error" />}
      {!isLoading && !error && data?.data && <DenylistForm initial={data.data} />}
    </div>
  );
}

export function JournalGateTool() {
  return (
    <div>
      <AgentsSection />
      <LogSection />
      <DenylistSection />
    </div>
  );
}
