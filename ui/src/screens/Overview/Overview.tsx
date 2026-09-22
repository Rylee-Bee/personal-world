/**
 * Overview — the front page / headlines surface of Worlds.
 *
 * Per docs/PRODUCT-LANGUAGE.md the product-facing word is Overview
 * (was "Today"); it answers "what matters right now?" by aggregating
 * each enabled section's headline state, and is NOT a competing
 * content section. The implementation concepts underneath stay:
 * useTodaySummary still reads GET /api/status + /api/daily +
 * /api/prefs — server truth, never invented headlines.
 *
 * The Explore tiles activate destinations through the same
 * state-driven path as the nav buttons (onOpenArea). They used to be
 * <a href="/journal">-style anchors pointing at URLs nothing serves —
 * dead doors. No more.
 *
 * MSW provides mock data in Storybook/testing.
 */

import { useTodaySummary } from "../../data/hooks";
import { WorldSignal } from "../../components/WorldSignal";
import { ResidentPresence } from "../../components/ResidentPresence";
import { WorldAssistant } from "../../components/WorldAssistant";
import type { CapabilityStatus, WorldArea, WorldAreaId } from "../../data/types";

/** One honest word per status — text carries the signal, not color. */
function statusWord(status: CapabilityStatus): string {
  switch (status) {
    case "healthy":
      return "online";
    case "warning":
    case "needs_attention":
      return "attention";
    case "unavailable":
    case "stale":
      return "offline";
    case "disabled":
    case "not_configured":
      return "off";
    case "unknown":
      return "unknown";
  }
}

interface OverviewProps {
  /** Every reachable destination (skeleton landmarks + visible
   *  personal sections) — the same truth the nav bar renders. */
  areas: WorldArea[];
  /** State-driven activation, identical to the nav buttons. */
  onOpenArea: (id: WorldAreaId) => void;
  onOpenAssistant: () => void;
}

export function Overview({ areas, onOpenArea, onOpenAssistant }: OverviewProps) {
  const { data: summary, isLoading, error } = useTodaySummary();

  if (error) {
    return (
      <main id="main-content" aria-label="Overview" className="relative z-10 p-[var(--pw-spacing-xl)]">
        <h1 className="text-[var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]">
          Overview
        </h1>
        <p className="mt-[var(--pw-spacing-xl)] text-[var(--pw-text-secondary)]">
          Unable to load your world right now.
        </p>
        <p className="mt-1 text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          {error.message}
        </p>
      </main>
    );
  }

  if (isLoading || !summary) {
    return (
      <main id="main-content" aria-label="Overview" className="relative z-10 p-[var(--pw-spacing-xl)]">
        <h1 className="text-[var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]">
          Overview
        </h1>
        <p className="mt-[var(--pw-spacing-xl)] text-[var(--pw-text-muted)]">
          Loading your world…
        </p>
      </main>
    );
  }

  const needsAttention = summary.capabilities.filter(
    (c) =>
      c.status === "warning" ||
      c.status === "needs_attention" ||
      c.status === "unavailable" ||
      c.status === "stale",
  );

  return (
    <main id="main-content" aria-label="Overview" className="relative z-10 p-[var(--pw-spacing-xl)] md:p-[var(--pw-spacing-3xl)] max-w-[720px]">
      {/* Greeting */}
      <header className="mb-[var(--pw-spacing-2xl)]">
        <p className="text-[var(--pw-typography-size_label)] font-medium uppercase tracking-[0.16em] text-[var(--pw-text-muted)] mb-1">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
          })}
        </p>
        <h1 className="text-[var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)] leading-tight">
          {summary.greeting}, <span className="text-[var(--pw-accent-primary)]">Operator</span>
        </h1>
        {summary.resident && (
          <div className="mt-[var(--pw-spacing-lg)]">
            <ResidentPresence resident={summary.resident} />
          </div>
        )}
      </header>

      {/* Health summary */}
      <div className="mb-[var(--pw-spacing-2xl)] p-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)]">
        <p className="text-[var(--pw-typography-size_lead)] font-medium text-[var(--pw-text-primary)]">
          Your world looks{" "}
          {needsAttention.length === 0 ? (
            <span className="text-[var(--pw-accent-green)]">healthy</span>
          ) : (
            <span className="text-[var(--pw-accent-warm)]">busy</span>
          )}
          <span className="text-[var(--pw-accent-primary)]"> ·</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-[var(--pw-spacing-lg)] text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          <span><span className="text-[var(--pw-accent-green)]">●</span> {summary.capabilities.filter((c) => c.status === "healthy").length} connected</span>
          <span><span className="text-[var(--pw-accent-warm)]">●</span> {needsAttention.length} need attention</span>
          <span><span className="text-[var(--pw-text-muted)]">●</span> {summary.capabilities.filter((c) => c.status === "disabled" || c.status === "not_configured").length} offline</span>
        </div>
      </div>

      {/* Signals */}
      {summary.signals.length > 0 && (
        <section aria-label="Attention" className="mb-[var(--pw-spacing-2xl)]">
          <h2 className="mb-[var(--pw-spacing-md)] text-[var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-accent-warm)]">
            Attention
          </h2>
          <div className="space-y-[var(--pw-spacing-md)]">
            {summary.signals.map((signal) => (
              <WorldSignal
                key={signal.id}
                level={signal.level}
                title={signal.title}
                description={signal.description}
                technical={signal.technical}
              />
            ))}
          </div>
        </section>
      )}

      {/* World areas — every reachable destination, activated the same
          way the nav bar activates it. Overview is the tap-through
          surface, so this grid mirrors the nav's truth exactly. */}
      <section aria-label="World areas" className="mb-[var(--pw-spacing-2xl)]">
        <h2 className="mb-[var(--pw-spacing-md)] text-[var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
          Explore
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[var(--pw-spacing-md)]">
          {areas.filter((a) => a.id !== "overview").map((area) => (
            <button
              key={area.id}
              type="button"
              onClick={() => onOpenArea(area.id)}
              className="group flex flex-col items-center gap-[var(--pw-spacing-sm)] p-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] min-h-[var(--pw-targets-minimum)] transition-colors motion-reduce:transition-none hover:border-[var(--pw-accent-primary)] hover:bg-[var(--pw-surface-elevated)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
            >
              <span className="text-[var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)] group-hover:text-[var(--pw-accent-primary)]">
                {area.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Capabilities */}
      <section aria-label="Capabilities" className="mb-[var(--pw-spacing-2xl)]">
        <h2 className="mb-[var(--pw-spacing-md)] text-[var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
          Your World
        </h2>
        <div className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]">
          {summary.capabilities.length === 0 ? (
            <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">No capabilities connected yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--pw-spacing-md)]">
              {summary.capabilities.map((cap) => (
                <div key={cap.id} className="flex items-center gap-[var(--pw-spacing-md)] p-[var(--pw-spacing-md)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)]">
                  <span className={["h-2 w-2 rounded-full shrink-0", cap.status === "healthy" ? "bg-[var(--pw-accent-green)]" : cap.status === "needs_attention" ? "bg-[var(--pw-accent-warm)]" : "bg-[var(--pw-text-muted)]"].join(" ")} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)] truncate">{cap.name}</p>
                    {cap.summary && <p className="text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)] truncate">{cap.summary}</p>}
                  </div>
                  <span className="text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)] shrink-0">
                    {statusWord(cap.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Floating assistant trigger — lifted clear of the home-indicator
          band and the notch side on notched devices (§2.7); its 44px+
          target never sits under an inset. */}
      <div className="fixed bottom-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-bottom))] right-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-right))] z-30">
        <WorldAssistant onOpen={onOpenAssistant} residentName={summary.resident?.name} />
      </div>
    </main>
  );
}
