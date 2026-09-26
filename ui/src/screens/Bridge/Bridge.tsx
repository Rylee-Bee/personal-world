/**
 * Bridge — the home screen (area id "overview").
 *
 * One experience, four parts: the KEEPER speaks (the line at the
 * bottom, a ship's status line), the BRIEFING is the content, the
 * BRIDGE is the way to explore, and each system speaks in its
 * resident's own voice. Calm but alive — a star map, not a dashboard.
 *
 * Shape (contract v1, slice 1b):
 *   GET /api/briefing → systems + residents + rooms + the Keeper line
 *   GET /api/place    → where she was when she left
 *   PUT /api/place    → remember the selection (debounced ~600ms)
 *
 * Honesty is absolute: a system that is `not_configured`, `stale`,
 * `unavailable`, or `unknown` says so in the resident's voice; the
 * screen NEVER invents an item. A briefing failure is named plainly
 * ("Couldn't reach your world right now") with a retry — never a fake
 * world behind a spinner.
 *
 * Accessibility (non-negotiable): the map bodies are BUTTONS with a
 * full spoken label; the landmark structure is header strip → nav
 * lenses → main star map → complementary briefing panel → keeper line;
 * every control is keyboard reachable with a visible focus ring; the
 * twinkle is CSS that only animates when motion is explicitly allowed
 * and is switched off by OS prefers-reduced-motion.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useBriefing, usePlace, useSetPlace } from "../../data/hooks";
import { STATUS_LABELS, toCapabilityStatus, type WorldAreaId } from "../../data/types";
import type {
  BridgeData,
  BridgeItem,
  BridgeSystem,
  BridgeSystemId,
} from "../../data/contract";
import { ResidentPresence } from "../../components/ResidentPresence";
import { RoomsPanel } from "../../components/RoomsPanel";
import { WorldAssistant } from "../../components/WorldAssistant";
import { chooseDefaultSystem, knownArea, trayOverflow } from "./geometry";
import { StarMap } from "./StarMap";

interface BridgeProps {
  /** State-driven activation, identical to the nav buttons. */
  onOpenArea: (id: WorldAreaId) => void;
  onOpenAssistant: () => void;
}


/** One honest word per status — text carries the signal (§1.3). */
function statusWord(raw: string): string {
  return STATUS_LABELS[toCapabilityStatus(raw)];
}


/** The phone layout (< 860px) is where the panel is a bottom sheet.
 *  Absent matchMedia (SSR-ish) means unknown, which resolves to the
 *  static desktop panel — never a sheet with no way out. */
function isPhoneLayout(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(max-width: 859.98px)").matches;
}


/** A calm, never-red accent for the tray and chips (words carry the
 *  meaning; colour is reinforcement only). */
const CALM_ACCENT = "var(--pw-accent-warm)";

export function Bridge({ onOpenArea, onOpenAssistant }: BridgeProps) {
  const briefing = useBriefing();
  const place = usePlace();
  const setPlace = useSetPlace();

  const data = briefing.data?.data;
  const storedSystem = place.data?.data?.place?.system ?? null;

  const [selectedId, setSelectedId] = useState<BridgeSystemId | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Only a PERSON's action is remembered — the opening selection is the
  // world's, not hers, so it never writes the place on her behalf.
  const hasInteracted = useRef(false);
  const panelToggleRef = useRef<HTMLButtonElement>(null);
  const panelCloseRef = useRef<HTMLButtonElement>(null);

  // Open: the stored place if this briefing carries it, else the system
  // with the most new arrivals, else "agents". DERIVED during render,
  // not written into state from an effect — so a stored place can never
  // lose a race to the fallback (both queries must settle first), and
  // the world's own choice never becomes a state the person owns.
  const placeSettled = !place.isPending;
  const activeId =
    selectedId ??
    (data !== undefined && placeSettled
      ? chooseDefaultSystem(data, storedSystem)
      : null);

  // Remember: debounce the place write so a flurry of taps settles into
  // one honest PUT of where she actually ended up.
  useEffect(() => {
    if (!hasInteracted.current || activeId === null) return;
    const timer = window.setTimeout(() => {
      setPlace.mutate({ system: activeId, item_id: expandedItemId });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [activeId, expandedItemId, setPlace]);

  function selectSystem(
    id: BridgeSystemId,
    options?: { expandItemId?: string | null },
  ) {
    hasInteracted.current = true;
    setSelectedId(id);
    setExpandedItemId(options?.expandItemId ?? null);
    setPanelOpen(true);
  }

  function toggleItem(item: BridgeItem) {
    hasInteracted.current = true;
    setExpandedItemId((current) => (current === item.id ? null : item.id));
  }

  /** Dismiss the phone sheet and hand focus back to its toggle (§3.5). */
  function closePanel() {
    setPanelOpen(false);
    panelToggleRef.current?.focus();
  }

  if (briefing.isPending) {
    return (
      <BridgeFrame>
        <p className="text-[var(--pw-text-muted)]">Gathering your world…</p>
      </BridgeFrame>
    );
  }

  if (briefing.isError || briefing.data?.ok !== true || data === undefined) {
    return (
      <BridgeFrame>
        <p className="text-[var(--pw-text-secondary)]">
          Couldn't reach your world right now.
        </p>
        <p className="mt-1 text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          {briefing.error instanceof Error && briefing.error.message
            ? briefing.error.message
            : "The station did not answer. Nothing here is invented."}
        </p>
        <button
          type="button"
          onClick={() => void briefing.refetch()}
          className="mt-[var(--pw-spacing-lg)] inline-flex min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] items-center justify-center rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] px-[var(--pw-spacing-lg)] py-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)] hover:bg-[var(--pw-surface-elevated)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
        >
          Try again
        </button>
      </BridgeFrame>
    );
  }

  const systems = data.systems;
  const selected =
    systems.find((s) => s.id === activeId) ?? systems[0] ?? null;
  const arrivals = systems.reduce((n, s) => n + (s.counts?.arrivals ?? 0), 0);
  const overall = statusWord(briefing.data?.status ?? "unknown");

  return (
    <BridgeFrame>
      <div className="bridge-layout">
        {/* ── Top status strip ─────────────────────────────────────── */}
        <header className="bridge-strip flex flex-wrap items-baseline justify-between gap-x-[var(--pw-spacing-lg)] gap-y-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)]/80 p-[var(--pw-spacing-lg)]">
          <div className="min-w-0">
            <p className="text-[length:var(--pw-typography-size_label)] font-medium uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
            <p className="text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
              Local time{" "}
              <span suppressHydrationWarning>
                {new Date().toLocaleTimeString("en-US", { hour12: false })}
              </span>
            </p>
          </div>
          <div className="flex items-baseline gap-[var(--pw-spacing-lg)]">
            <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
              {arrivals} arrived · {data.have_tos_total} need you
            </p>
            <p className="text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-text-primary)]">
              {overall}
            </p>
          </div>
          {data.since !== null && (
            <p className="w-full text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
              Since you were here · {sinceLabel(data.since)}
            </p>
          )}
        </header>

        {/* ── Needs you — a calm tray, never red ──────────────────── */}
        <NeedsTray data={data} onPick={(item) =>
          selectSystem(item.system, { expandItemId: item.id })
        } />

        {/* ── Lenses — a left list on desktop, a scroller on phone ── */}
        <nav
          aria-label="World lenses"
          className="bridge-lenses min-w-0"
        >
          <h2 className="mb-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
            Lenses
          </h2>
          <ul className="flex gap-[var(--pw-spacing-xs)] overflow-x-auto overscroll-x-contain pb-[var(--pw-spacing-xs)] min-[860px]:flex-col min-[860px]:overflow-visible min-[860px]:pb-0">
            {systems.map((system) => {
              const isActive = selected?.id === system.id;
              return (
                <li key={system.id} className="shrink-0 min-[860px]:shrink">
                  <button
                    type="button"
                    onClick={() => selectSystem(system.id)}
                    aria-current={isActive ? "true" : undefined}
                    aria-label={`${system.name} — ${statusWord(system.status)}`}
                    className={[
                      "flex w-full min-h-[var(--pw-targets-minimum)] items-center gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] text-left text-[length:var(--pw-typography-size_small)] font-medium",
                      "transition-colors duration-150 motion-reduce:transition-none focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]",
                      isActive
                        ? "bg-[var(--pw-accent-teal_soft)] text-[var(--pw-text-primary)]"
                        : "text-[var(--pw-text-secondary)] hover:bg-[var(--pw-surface-elevated)] hover:text-[var(--pw-text-primary)]",
                    ].join(" ")}
                  >
                    <span aria-hidden="true" className="truncate">
                      {system.name}
                    </span>
                    <span className="ml-auto shrink-0 text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
                      {statusWord(system.status)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── Star map ─────────────────────────────────────────────── */}
        <section
          aria-label="Star map"
          className="bridge-map relative min-h-[320px] min-w-0 overflow-hidden rounded-[var(--pw-radius-lg)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)] min-[860px]:min-h-[440px]"
        >
          <h2 className="sr-only">Star map</h2>
          <div className="starfield-bg" aria-hidden="true" />
          <div className="grid-overlay" aria-hidden="true" />
          {/* Subtle twinkle — CSS-only, off unless motion is allowed. */}
          {TWINKLE_STARS.map((star) => (
            <span
              key={`${star.x}-${star.y}`}
              aria-hidden="true"
              className="bridge-star"
              style={{ left: `${star.x}%`, top: `${star.y}%` }}
            />
          ))}
          <StarMap
            keeper={data.keeper}
            systems={systems}
            selectedId={selected?.id ?? null}
            onSelect={(id) => selectSystem(id)}
            statusWord={statusWord}
          />

          {/* Phone: the briefing panel is a bottom sheet with a toggle. */}
          <button
            ref={panelToggleRef}
            type="button"
            aria-expanded={panelOpen}
            aria-controls="bridge-panel"
            onClick={() => setPanelOpen((open) => !open)}
            className="mt-[var(--pw-spacing-md)] inline-flex min-h-[var(--pw-targets-minimum)] w-full items-center justify-center rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-elevated)] px-[var(--pw-spacing-lg)] py-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)] min-[860px]:hidden"
          >
            {panelOpen ? "Hide briefing" : "Show briefing"}
          </button>
        </section>

        {/* ── Briefing panel — complementary region ────────────────── */}
        {selected !== null && (
          <BriefingPanel
            system={selected}
            expandedItemId={expandedItemId}
            isOpen={panelOpen}
            onToggleItem={toggleItem}
            onOpenArea={onOpenArea}
            onClose={closePanel}
            closeRef={panelCloseRef}
          />
        )}

        {/* ── Rooms — the other small backends, honestly reported ──── */}
        <RoomsPanel />

      </div>

      {/* Floating assistant trigger — clear of the home-indicator band
          and the notch side (§2.7). */}
      <div className="fixed bottom-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-bottom))] right-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-right))] z-30">
        <WorldAssistant
          onOpen={onOpenAssistant}
          residentName={data.keeper.resident.name}
        />
      </div>
    </BridgeFrame>
  );
}

/** The stable page shell: one h1, one main landmark, every state. */
function BridgeFrame({ children }: { children: ReactNode }) {
  return (
    <main
      id="main-content"
      aria-label="Bridge"
      className="relative z-10 p-[var(--pw-spacing-lg)] md:p-[var(--pw-spacing-xl)]"
    >
      <h1 className="sr-only">Bridge</h1>
      {children}
    </main>
  );
}

function sinceLabel(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "an unknown time";
  return when.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const TWINKLE_STARS: readonly { x: number; y: number }[] = [
  { x: 12, y: 18 },
  { x: 34, y: 9 },
  { x: 58, y: 22 },
  { x: 78, y: 12 },
  { x: 88, y: 38 },
  { x: 22, y: 44 },
  { x: 64, y: 52 },
  { x: 8, y: 62 },
  { x: 46, y: 74 },
  { x: 82, y: 68 },
];

/* ── System body — the glowing map button ─────────────────────────── */

/* ── Needs-you tray ───────────────────────────────────────────────── */

function NeedsTray({
  data,
  onPick,
}: {
  data: BridgeData;
  onPick: (item: BridgeItem) => void;
}) {
  const overflow = trayOverflow(data);
  const items = data.have_tos.slice(0, 3);
  if (items.length === 0) {
    return (
      <section
        aria-label="Needs you"
        className="bridge-tray rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
      >
        <h2 className="text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
          Needs you
        </h2>
        <p className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          Nothing is waiting on you right now.
        </p>
      </section>
    );
  }
  return (
    <section
      aria-label="Needs you"
      className="bridge-tray rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
    >
      <h2 className="text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
        Needs you
      </h2>
      <ul className="mt-[var(--pw-spacing-sm)] space-y-[var(--pw-spacing-xs)]">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onPick(item)}
              className="flex w-full min-h-[var(--pw-targets-minimum)] items-baseline gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] px-[var(--pw-spacing-sm)] py-[var(--pw-spacing-xs)] text-left hover:bg-[var(--pw-surface-elevated)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
            >
              <span
                aria-hidden="true"
                className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: CALM_ACCENT }}
              />
              <span className="min-w-0 text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-primary)]">
                {item.title}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {overflow > 0 && (
        <p className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
          and {overflow} more, quietly waiting
        </p>
      )}
    </section>
  );
}

/* ── Briefing panel ───────────────────────────────────────────────── */

function BriefingPanel({
  system,
  expandedItemId,
  isOpen,
  onToggleItem,
  onOpenArea,
  onClose,
  closeRef,
}: {
  system: BridgeSystem;
  expandedItemId: string | null;
  isOpen: boolean;
  onToggleItem: (item: BridgeItem) => void;
  onOpenArea: (id: WorldAreaId) => void;
  onClose: () => void;
  closeRef: { current: HTMLButtonElement | null };
}) {
  const arrivals = system.counts?.arrivals ?? 0;
  const haveTos = system.counts?.have_tos ?? 0;

  // Phone sheet: focus moves in on open, Escape dismisses (focus returns
  // to the toggle through onClose — §3.5). On desktop the panel is a
  // static complementary region, so neither applies.
  useEffect(() => {
    if (!isOpen || !isPhoneLayout()) return;
    closeRef.current?.focus();
  }, [isOpen, closeRef]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const panelClasses = [
    "bridge-panel rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]",
    isOpen ? "block" : "hidden",
    "min-[860px]:block",
    "max-[859px]:fixed max-[859px]:inset-x-0 max-[859px]:bottom-0 max-[859px]:z-40 max-[859px]:max-h-[50vh] max-[859px]:overflow-y-auto",
    "max-[859px]:rounded-b-none max-[859px]:border-t max-[859px]:pb-[calc(var(--pw-spacing-lg)_+_var(--pw-safe-area-inset-bottom))]",
  ].join(" ");

  return (
    <aside id="bridge-panel" aria-label="Briefing panel" className={panelClasses}>
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        className="mb-[var(--pw-spacing-sm)] inline-flex min-h-[var(--pw-targets-minimum)] items-center text-[length:var(--pw-typography-size_small)] text-[var(--pw-accent-primary)] underline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)] min-[860px]:hidden"
      >
        Close briefing
      </button>

      <h2 className="text-[length:var(--pw-typography-size_h2)] font-semibold text-[var(--pw-text-primary)]">
        {system.name}
      </h2>
      <div className="mt-[var(--pw-spacing-md)]">
        {system.resident !== null ? (
          <ResidentPresence
            size="sm"
            resident={{
              id: system.resident.key ?? "",
              name: system.resident.name,
              artwork: system.resident.portrait ?? undefined,
            }}
          />
        ) : (
          /* A hidden or gone companion: the plain emblem, never a face
           * borrowed from someone else (no invented presence). */
          <span
            aria-hidden="true"
            className="inline-block h-12 w-12 shrink-0 rounded-full border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)]"
          />
        )}
      </div>

      <p className="mt-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]">
        <span className="text-[var(--pw-text-muted)]">Status: </span>
        {statusWord(system.status)}
      </p>
      <p className="mt-[var(--pw-spacing-xs)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
        “{system.voice}”
      </p>
      <p className="mt-[var(--pw-spacing-xs)] text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
        {arrivals} new · {haveTos} need you
      </p>

      <h3 className="mt-[var(--pw-spacing-lg)] text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
        Here now
      </h3>
      {system.items.length === 0 ? (
        <p className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          Nothing to show here yet.
        </p>
      ) : (
        <ul className="mt-[var(--pw-spacing-sm)] space-y-[var(--pw-spacing-sm)]">
          {system.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              expanded={expandedItemId === item.id}
              onToggle={() => onToggleItem(item)}
              onOpenArea={onOpenArea}
            />
          ))}
        </ul>
      )}
    </aside>
  );
}

/* ── One briefing item ────────────────────────────────────────────── */

function ItemRow({
  item,
  expanded,
  onToggle,
  onOpenArea,
}: {
  item: BridgeItem;
  expanded: boolean;
  onToggle: () => void;
  onOpenArea: (id: WorldAreaId) => void;
}) {
  const detailId = `bridge-detail-${item.id}`;
  const area = knownArea(item.link?.area ?? null);
  return (
    <li className="rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={detailId}
        className="flex w-full min-h-[var(--pw-targets-minimum)] flex-wrap items-center gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] text-left focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
      >
        {item.new && (
          <span
            className="rounded-[var(--pw-radius-full)] border px-2 py-0.5 text-[length:var(--pw-typography-size_micro)] font-medium"
            style={{
              borderColor: CALM_ACCENT,
              color: "var(--pw-text-primary)",
            }}
          >
            Since you were here
          </span>
        )}
        <span className="min-w-0 flex-1 text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-primary)]">
          {item.title}
        </span>
      </button>
      <div
        id={detailId}
        hidden={!expanded}
        className="px-[var(--pw-spacing-md)] pb-[var(--pw-spacing-md)]"
      >
        {item.detail !== null && (
          <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            {item.detail}
          </p>
        )}
        {item.at !== null && (
          <p className="mt-[var(--pw-spacing-xs)] text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
            {sinceLabel(item.at)}
          </p>
        )}
        {item.link !== null && (area !== null || item.link.href !== null) && (
          <div className="mt-[var(--pw-spacing-sm)] flex flex-wrap gap-[var(--pw-spacing-md)]">
            {area !== null && (
              <button
                type="button"
                onClick={() => onOpenArea(area)}
                className="inline-flex min-h-[var(--pw-targets-minimum)] items-center text-[length:var(--pw-typography-size_small)] text-[var(--pw-accent-primary)] underline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
              >
                {item.link.label}
              </button>
            )}
            {area === null && item.link.href !== null && (
              <a
                href={item.link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[var(--pw-targets-minimum)] items-center text-[length:var(--pw-typography-size_small)] text-[var(--pw-accent-primary)] underline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
              >
                {item.link.label}
              </a>
            )}
          </div>
        )}
      </div>
    </li>
  );
}