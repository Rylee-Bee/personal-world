/**
 * DiscoverySliver — the daily home loop's "Discover" beat
 * (TRUE-NORTH): one small "brought to you" card, the mixtape
 * pattern inside Overview — small batch, earned cadence, pull by
 * default. No separate discovery surface in the first release;
 * Interests remains the full home of sources and finds.
 *
 * This lane ships the SLOT with honest empty states; wiring a real
 * feed is not part of it. The state comes from the existing
 * GET /api/discovery/status envelope only:
 *   no sources  → "no source yet", warmly said;
 *   sources, no batch yet → the cadence promise, plainly;
 *   a batch waiting → its true count and one tap to Interests;
 *   unreadable  → "unavailable", never a fabricated pick.
 */

import { useDiscoveryStatus } from "../../data/hooks";
import type { WorldAreaId } from "../../data/types";
import { discoverySliverState } from "./home-loop";

interface DiscoverySliverProps {
  onOpenArea: (id: WorldAreaId) => void;
}

export function DiscoverySliver({ onOpenArea }: DiscoverySliverProps) {
  const status = useDiscoveryStatus();
  const view = discoverySliverState(status.data, status.isError);

  const body = (() => {
    switch (view.kind) {
      case "unavailable":
        return (
          <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            Discovery is unavailable right now. Nothing is pretended
            in its place.
          </p>
        );
      case "no-source":
        return (
          <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            No source yet. When you add one in Interests, Worlds
            brings a small batch here now and then — never a
            firehose.
          </p>
        );
      case "listening":
        return (
          <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            {view.sources === 1 ? "One source is" : `${view.sources} sources are`}{" "}
            listening. The next small batch arrives on its own
            cadence — you never have to come looking.
          </p>
        );
      case "waiting":
        return (
          <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            {view.items === 1
              ? "One small pick is"
              : `${view.items} small picks are`}{" "}
            waiting for you in Interests.
          </p>
        );
    }
  })();

  return (
    <section aria-label="Brought to you" className="mb-[var(--pw-spacing-2xl)]">
      <h2 className="mb-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
        Brought to you
      </h2>
      <div className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]">
        {body}
        {view.kind === "no-source" || view.kind === "waiting" ? (
          <button
            type="button"
            onClick={() => onOpenArea("interests")}
            className="mt-[var(--pw-spacing-md)] inline-flex min-h-[var(--pw-targets-minimum)] items-center text-[length:var(--pw-typography-size_small)] font-medium text-[var(--pw-accent-primary)] underline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
          >
            {view.kind === "no-source" ? "Open Interests" : "See them in Interests"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
