/**
 * Interests — engine finds with honest provenance (C3) and honest
 * empty states (C4).
 *
 * The old Station's interests view (design/opendesign-exploration/
 * station/interests-view.js) read the followed-interests list only
 * (API-051) and said plainly that the discovery feed (API-052) was
 * "not consumed on this surface yet". This screen consumes it: engine
 * findings from GET /api/discovery/discover, each with a provenance
 * line — where it came from, when, and what the capture mode is —
 * plus the followed-interests list from the same status envelope.
 *
 * The check is USER-INITIATED. The engine talks to the network and
 * returns only new finds since the last check (discovery/world_run.py
 * keeps a bounded capture window, not an archive); opening a page
 * must not fire that silently, and a poll must never announce itself
 * at a screen-reader user (a11y contract §8.2).
 *
 * Honesty floor (C4): "nothing captured yet", "capture off", and
 * "captured nothing matching" are different truths and get different
 * one-sentence labels — no cheer, no shame, no sample content.
 *
 * Accessibility floor: §2.1 44px targets · §2.2/§2.4 keyboard path +
 * composed focus ring (world.css :focus-visible, plus explicit
 * outline classes) · §4.1 real heading order h1→h2→h3 · §1.3/§1.4
 * state in words · §1.5 static loading text · §6.2 transitions are
 * colour-only and disabled under prefers-reduced-motion.
 */

import { useCallback, useState } from "react";
import { useDiscoveryStatus } from "../../data/hooks";
import { triggerDiscovery } from "../../data/api";
import { describeError } from "../../data/errors";
import { WorldButton } from "../../components/WorldButton";
import {
  captureModeNote,
  parseDiscoverRun,
  parseDiscoveryStatus,
  plural,
  type DiscoverRun,
  type DiscoveryFinding,
} from "./parse";

// ─── Check-run state machine (local, deliberate) ─────────────────────

type CheckPhase =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "done"; run: DiscoverRun; error: null }
  | { kind: "failed"; run: null; error: string };

/** ISO timestamp → readable words; an unparseable stamp is shown raw. */
function formatWhen(iso: string | null): { text: string; valid: boolean } | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return { text: iso, valid: false };
  return {
    text: new Date(ms).toLocaleString([], {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }),
    valid: true,
  };
}

// ─── One finding row ─────────────────────────────────────────────────

function FindingItem({ finding }: { finding: DiscoveryFinding }) {
  const when = formatWhen(finding.discovered_at);
  return (
    <li className="rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] p-[var(--pw-spacing-md)]">
      <h3 className="text-[var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]">
        {finding.url ? (
          <a
            href={finding.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-[var(--pw-accent-primary)] underline-offset-2 transition-colors motion-reduce:transition-none focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
          >
            {finding.title}
            <span className="text-[var(--pw-typography-size_micro)]">
              {" "}(opens in a new tab)
            </span>
          </a>
        ) : (
          finding.title
        )}
      </h3>
      {finding.description !== null && (
        <p className="mt-1 text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          {finding.description}
        </p>
      )}
      {/* Provenance line: where + when, in one sentence (§1.4). */}
      <p className="mt-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
        From <strong>{finding.source}</strong>
        {" · "}kind: {finding.content_type}
        {typeof finding.provenance["engine"] === "string" && (
          <>
            {" · "}engine: {String(finding.provenance["engine"])}
          </>
        )}
        {typeof finding.provenance["source_type"] === "string" && (
          <>
            {" · "}source kind: {String(finding.provenance["source_type"])}
          </>
        )}
        {when !== null && (
          <>
            {" · "}found{" "}
            {when.valid ? (
              <time dateTime={finding.discovered_at ?? undefined}>{when.text}</time>
            ) : (
              when.text
            )}
          </>
        )}
      </p>
      {/* Capture-mode note: what happened to this item, plainly. */}
      <p className="mt-1 text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
        {captureModeNote(finding)}
      </p>
    </li>
  );
}

// ─── The screen ──────────────────────────────────────────────────────

export function Interests() {
  const statusQuery = useDiscoveryStatus();
  const [check, setCheck] = useState<CheckPhase>({ kind: "idle" });

  const runCheck = useCallback(() => {
    setCheck({ kind: "checking" });
    triggerDiscovery()
      .then((envelope) => {
        setCheck({ kind: "done", run: parseDiscoverRun(envelope), error: null });
      })
      .catch((err: unknown) => {
        setCheck({
          kind: "failed",
          run: null,
          error: describeError(err, "The check could not be completed."),
        });
      });
  }, []);

  const status = parseDiscoveryStatus(statusQuery.data);
  const enabledSources = status.sources.filter((s) => s.enabled).length;

  // Findings-section honest state, decided in one place (§4.5 words).
  function findingsState(): { label: string; detail: string | null } {
    if (status.softFailure) {
      return {
        label: "The station reported the discovery engine as unavailable.",
        detail:
          status.softFailure.warnings[0] ?? status.softFailure.status ?? null,
      };
    }
    if (status.sources.length === 0) {
      return {
        label: "Nothing captured yet — this station has no discovery sources added.",
        detail: null,
      };
    }
    if (enabledSources === 0) {
      return {
        label: "Capture off — the configured sources are all switched off, so nothing is being checked.",
        detail: plural(status.sources.length, "source", "sources") + " configured, none enabled.",
      };
    }
    if (check.kind === "idle" || check.kind === "checking") {
      return {
        label: "No check run since you opened this view.",
        detail:
          "Each check reports only what is new since the previous one — the engine keeps a bounded capture window, not an archive.",
      };
    }
    if (check.kind === "failed") {
      return { label: `The check did not finish: ${check.error}`, detail: null };
    }
    if (check.run.softFailure) {
      return {
        label: "The station declined to run the check.",
        detail:
          check.run.softFailure.warnings[0] ?? check.run.softFailure.status ?? null,
      };
    }
    if (check.run.count === 0 && check.run.sourcesQueried > 0) {
      return {
        label: `Captured nothing matching — ${plural(check.run.sourcesQueried, "source", "sources")} checked, no new finds.`,
        detail: null,
      };
    }
    return { label: "", detail: null }; // real findings below
  }

  const findings = findingsState();

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-[var(--pw-spacing-md)] focus:left-[var(--pw-spacing-md)] focus:z-50 focus:px-[var(--pw-spacing-lg)] focus:py-[var(--pw-spacing-sm)] focus:bg-[var(--pw-surface-panel)] focus:text-[var(--pw-text-secondary)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)] focus:rounded-[var(--pw-radius-sm)]"
      >
        Skip to main content
      </a>

      <main
        id="main-content"
        aria-label="Interests"
        className="relative z-10 p-[var(--pw-spacing-xl)] md:p-[var(--pw-spacing-3xl)] max-w-[720px]"
      >
        <header className="mb-[var(--pw-spacing-2xl)]">
          <h1 className="text-[var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]">
            Interests
          </h1>
          <p className="mt-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
            What the station's discovery engine turns up, and what it follows.
          </p>
        </header>

        {/* Loading / failure of the status read — never hidden (§1.5 static). */}
        {statusQuery.isPending && (
          <p role="status" className="mb-[var(--pw-spacing-lg)] text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
            Loading…
          </p>
        )}
        {statusQuery.isError && (
          <p role="alert" className="mb-[var(--pw-spacing-lg)] text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            {"Your interests could not be read from the station. Nothing was changed. "}
            {statusQuery.error instanceof Error
              ? statusQuery.error.message
              : "No reason was given."}
          </p>
        )}

        {/* Engine finds */}
        <section
          aria-labelledby="interests-finds-heading"
          className="mb-[var(--pw-spacing-2xl)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
        >
          <h2
            id="interests-finds-heading"
            className="mb-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]"
          >
            Engine finds
          </h2>

          <div className="flex flex-wrap items-center gap-[var(--pw-spacing-md)] mb-[var(--pw-spacing-md)]">
            <WorldButton
              variant="primary"
              type="button"
              onPress={runCheck}
              isDisabled={check.kind === "checking" || statusQuery.isPending || statusQuery.isError}
            >
              {check.kind === "checking" ? "Checking…" : "Check sources now"}
            </WorldButton>
            {check.kind === "checking" && (
              <p role="status" className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
                Asking the enabled sources — this reads the network and may take a moment.
              </p>
            )}
          </div>

          {/* User-triggered outcome: one polite line, then the list. */}
          {check.kind === "done" && check.run.items.length > 0 && (
            <p role="status" aria-live="polite" className="mb-[var(--pw-spacing-md)] text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
              Check finished — {plural(check.run.items.length, "new find", "new finds")}.
            </p>
          )}

          {check.kind === "done" && check.run.items.length > 0 ? (
            <ul role="list" className="space-y-[var(--pw-spacing-md)]">
              {check.run.items.map((finding) => (
                <FindingItem key={finding.id} finding={finding} />
              ))}
            </ul>
          ) : (
            <div>
              <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
                {findings.label}
              </p>
              {findings.detail !== null && (
                <p className="mt-1 text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
                  {findings.detail}
                </p>
              )}
            </div>
          )}

          {check.kind === "done" && check.run.skippedRows > 0 && (
            <p className="mt-[var(--pw-spacing-md)] text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
              {plural(check.run.skippedRows, "row", "rows")} came back in a
              shape this view does not understand and was left out rather
              than guessed at.
            </p>
          )}

          {/* Source roster — words about what would be checked (§1.4). */}
          {status.sources.length > 0 && (
            <p className="mt-[var(--pw-spacing-lg)] text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
              Sources on this station:{" "}
              {status.sources
                .map((s) => `${s.name} (${s.enabled ? "on" : "off"})`)
                .join(", ")}
              .
            </p>
          )}
        </section>

        {/* Followed interests — read-only, honestly labelled. */}
        <section
          aria-labelledby="interests-following-heading"
          className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
        >
          <h2
            id="interests-following-heading"
            className="mb-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]"
          >
            What you follow
          </h2>
          {status.interests.length === 0 ? (
            <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
              No interests followed yet — the station's list is genuinely
              empty, not hidden.
            </p>
          ) : (
            <ul role="list" className="space-y-[var(--pw-spacing-sm)]">
              {status.interests.map((interest) => {
                const followed = formatWhen(interest.created_at);
                return (
                  <li
                    key={interest.id}
                    className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-primary)]"
                  >
                    {interest.name}
                    {interest.category !== null && (
                      <span className="text-[var(--pw-text-muted)]">
                        {" "}
                        · category: {interest.category}
                      </span>
                    )}
                    {followed !== null && (
                      <span className="text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
                        {" "}
                        · followed since{" "}
                        {followed.valid ? (
                          <time dateTime={interest.created_at ?? undefined}>
                            {followed.text}
                          </time>
                        ) : (
                          followed.text
                        )}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-[var(--pw-spacing-md)] text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
            Read-only here: adding an interest is a step-up write
            (POST /api/discovery/interests) that this view deliberately
            does not fake.
          </p>
          {status.skippedRows > 0 && (
            <p className="mt-1 text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
              {plural(status.skippedRows, "row", "rows")} in the status
              reply were not in a shape this view understands and were
              skipped.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
