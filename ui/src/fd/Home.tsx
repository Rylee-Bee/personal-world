import { useEffect, useMemo, useRef, useState, type FocusEvent, type ReactNode } from "react";
import { DEFAULT_TIMEOUT_MS, useHomeData, type CardFailure } from "./api";
import { usePrefs } from "./prefs-core";
import { briefing, buildSections, greeting, SECTION_TITLE, type Row as HomeRow, type Sections } from "./home-model";
import { Row } from "./Row";
import { safeHref } from "./safe-href";
import { Strip, type StripEntry } from "./Strip";
import type { Board, BoardItem, CardEnvelope, NeedsYouEntry } from "./types";
import "./fd.css";

export interface HomeProps {
  timeZone?: string;
  /** Per-request timeout; a card that exceeds it becomes a failed row. Default 10s. */
  timeoutMs?: number;
  /** For tests: the clock the greeting reads. */
  now?: Date;
}

/**
 * A card that never loaded: unknown + stale, no values, no meter, never 0. The evidence carries only
 * what really happened (the failure class and any status), never an invented request id.
 */
function failedEnvelope(item: BoardItem, failure: CardFailure): CardEnvelope {
  return {
    card_id: item.card,
    source_state: "unknown",
    freshness: "stale",
    observed_at: null,
    fetched_at: "",
    last_good_at: null,
    values: {},
    meter: null,
    meaning: { short: "", full: "" },
    evidence: { request_id: "", method: "", path: "", error_class: failure.errorClass, status_code: failure.status },
  };
}

interface Snapshot {
  sections: Sections | null;
  entries: StripEntry[];
}


function snapshot(
  board: Board | undefined,
  cards: Record<string, CardEnvelope>,
  failures: Record<string, CardFailure>,
  pending: string[],
  needsYou: NeedsYouEntry[],
): Snapshot {
  if (!board) return { sections: null, entries: [] };
  const merged: Record<string, CardEnvelope> = { ...cards };
  for (const item of board.items) if (failures[item.card] && !merged[item.card]) merged[item.card] = failedEnvelope(item, failures[item.card]);
  const entries: StripEntry[] = [];
  for (const item of board.items) {
    if (item.hidden) continue;
    const card = merged[item.card];
    if (card) entries.push({ row: { item, card } });
    else if (pending.includes(item.card)) entries.push({ pending: { card: item.card, title: item.title, icon: item.icon } });
  }
  return { sections: buildSections(board, merged, needsYou), entries };
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`fd-home-section${className ? ` ${className}` : ""}`}>
      <h2 className="fd-home-section-title">{title}</h2>
      {children}
    </section>
  );
}

function NeedsYouList({ entries }: { entries: NeedsYouEntry[] }) {
  return (
    <ul className="fd-home-needs-you">
      {entries.map((entry) => {
        const href = entry.action.kind === "open" ? safeHref(entry.action.href) : null;
        return (
          <li key={entry.id} className="fd-home-needs-you-item">
            <span className="fd-home-needs-you-text">{entry.text}</span>
            <span className="fd-home-needs-you-source">{entry.source}</span>
            {entry.action.kind === "open" ? (
              href && (
                <a className="fd-btn fd-btn--primary fd-home-action" href={href} aria-label={`Open: ${entry.text}`}>
                  Open
                </a>
              )
            ) : (
              <>
                <button type="button" className="fd-btn fd-home-action" disabled aria-label={`Approve: ${entry.text}`}>
                  Approve
                </button>
                <span className="fd-home-note">Approving from here is not ready yet.</span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The front door. Greeting and briefing first, the whole-world strip, then the finite Needs you and
 * the row sections. The board, the needs-you list and every card load independently. Pick up is omitted
 * until it has data. Sections are not rebuilt while focus is inside them.
 */
export function Home({ timeZone, timeoutMs = DEFAULT_TIMEOUT_MS, now }: HomeProps) {
  const data = useHomeData(timeoutMs);
  const { board, boardStatus, needsYou, needsYouStatus, cards, failures, pending } = data;
  const { prefs } = usePrefs();
  const [openId, setOpenId] = useState<string | null>(null);
  const [quietOpen, setQuietOpen] = useState(false);
  const [revealTick, setRevealTick] = useState(0);
  const revealRef = useRef<string | null>(null);
  // While focus is inside Home, show the snapshot taken when focus arrived, so nothing moves under the user.
  const [focusIn, setFocusIn] = useState(false);
  const [heldSnap, setHeldSnap] = useState<Snapshot | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const live = useMemo(() => snapshot(board, cards, failures, pending, needsYou), [board, cards, failures, pending, needsYou]);
  const snap = focusIn && heldSnap?.sections ? heldSnap : live;
  const onFocus = () => {
    if (!focusIn) {
      setHeldSnap(live);
      setFocusIn(true);
    }
  };
  const onBlur = (e: FocusEvent) => {
    if (!(e.relatedTarget instanceof Node && rootRef.current?.contains(e.relatedTarget))) setFocusIn(false);
  };

  // A strip tap opens the row, unfolds Calm's quiet line if needed, scrolls to it and moves focus to it.
  useEffect(() => {
    const id = revealRef.current;
    if (!id) return;
    const el = document.getElementById(`fd-row-${id}`);
    if (!el) return;
    revealRef.current = null;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView?.({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    el.querySelector<HTMLElement>("button.fd-row-name")?.focus({ preventScroll: true });
  }, [revealTick, quietOpen, openId]);

  const sections = snap.sections;
  const { words, density } = prefs;
  const calmQuiet = density === "calm" && !quietOpen;

  const reveal = (cardId: string) => {
    setOpenId(cardId);
    if (sections?.quietly_working.some((r) => r.item.card === cardId)) setQuietOpen(true);
    revealRef.current = cardId;
    setRevealTick((n) => n + 1);
  };
  const toggle = (cardId: string) => setOpenId((cur) => (cur === cardId ? null : cardId));

  const failedCheck = needsYouStatus === "error";
  const base = sections
    ? briefing({ ...sections, needs_you: failedCheck ? [] : needsYou })
    : needsYou.length > 0
      ? `${needsYou.length} for you`
      : "";
  const ledeText = failedCheck ? ["Couldn't check what needs you", base].filter(Boolean).join(" · ") : base;

  const renderRow = (tier: 1 | 2 | 3) => (row: HomeRow) => (
    <Row
      key={row.item.card}
      item={row.item}
      card={row.card}
      words={words}
      density={density}
      timeZone={timeZone}
      expanded={openId === row.item.card}
      onToggle={() => toggle(row.item.card)}
      tier={tier}
    />
  );

  return (
    <div className="fd-home" ref={rootRef} onFocus={onFocus} onBlur={onBlur}>
      <header className="fd-home-head">
        <h1 className="fd-home-title">{greeting(now ?? new Date(), prefs.name)}</h1>
        {ledeText && <p className="fd-home-briefing">{ledeText}</p>}
      </header>

      {boardStatus === "error" && (
        <div className="fd-home-problem">
          <p className="fd-home-error" role="alert">
            Home could not load. Try again.
          </p>
          <button type="button" className="fd-btn fd-home-retry" onClick={data.refetchBoard}>
            Try again
          </button>
        </div>
      )}
      {boardStatus === "loading" && (
        <p className="fd-home-loading" role="status">
          Loading Home
        </p>
      )}

      {sections && (
        <>
          <Strip entries={snap.entries} onSelect={reveal} />
          {pending.length > 0 && (
            <p className="fd-home-checking" role="status">
              {`Checking ${pending.length} ${pending.length === 1 ? "source" : "sources"}`}
            </p>
          )}
          <div className="fd-home-editrow">
            <button type="button" className="fd-btn fd-btn--quiet fd-home-edit">
              Edit Home
            </button>
          </div>
        </>
      )}

      <div className="fd-home-body">
        <Section title={SECTION_TITLE.needs_you} className="fd-needs-band">
          {needsYouStatus === "error" ? (
            <div className="fd-home-problem">
              <p className="fd-home-error" role="alert">
                Couldn't check what needs you.
              </p>
              <button type="button" className="fd-btn fd-home-retry" onClick={data.refetchNeedsYou}>
                Retry
              </button>
            </div>
          ) : needsYouStatus === "loading" ? (
            <p className="fd-home-loading" role="status">
              Checking what needs you
            </p>
          ) : needsYou.length === 0 ? (
            <p className="fd-home-empty">Nothing for you right now.</p>
          ) : (
            <NeedsYouList entries={needsYou} />
          )}
        </Section>

        {sections && (
          <>
            <Section title={SECTION_TITLE.needs_look}>
              {sections.needs_look.length === 0 ? (
                <p className="fd-home-empty">Nothing needs a look. Everything is answering.</p>
              ) : (
                <ul className="fd-home-rows">{sections.needs_look.map(renderRow(1))}</ul>
              )}
            </Section>

            {sections.your_life.length > 0 && (
              <Section title={SECTION_TITLE.your_life}>
                <ul className="fd-home-rows">{sections.your_life.map(renderRow(2))}</ul>
              </Section>
            )}

            {sections.quietly_working.length > 0 && (
              <Section title={SECTION_TITLE.quietly_working}>
                {calmQuiet ? (
                  <p className="fd-home-quiet">
                    <span className="fd-home-quiet-line">{`${sections.quietly_working.length} quiet: ${sections.quietly_working.map((row) => row.item.title).join(", ")}`}</span>{" "}
                    <button type="button" className="fd-btn fd-btn--quiet fd-home-quiet-toggle" onClick={() => setQuietOpen(true)}>
                      Show
                    </button>
                  </p>
                ) : (
                  <ul className="fd-home-rows">{sections.quietly_working.map(renderRow(3))}</ul>
                )}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

