import { useMemo, useState, type ReactNode } from "react";
import { useHomeData } from "./api";
import { usePrefs } from "./prefs";
import { briefing, buildSections, SECTION_TITLE, type Row as HomeRow, type Sections } from "./home-model";
import { Row } from "./Row";
import { Strip } from "./Strip";
import type { Board, BoardItem, CardEnvelope } from "./types";
import "./fd.css";

export interface HomeProps {
  timeZone?: string;
}

/**
 * A card whose fetch failed becomes a synthetic envelope: unknown + stale,
 * no values, no meter, never 0. It lands in Needs a look so the person sees
 * that the source did not answer.
 */
function failedEnvelope(item: BoardItem): CardEnvelope {
  return {
    card_id: item.card,
    source_state: "unknown",
    freshness: "stale",
    observed_at: null,
    fetched_at: "",
    last_good_at: null,
    values: {},
    meter: null,
    meaning: { short: item.title, full: item.title },
    evidence: {
      request_id: `board.${item.card}`,
      method: "GET",
      path: `/api/cards/${item.card}`,
      error_class: "connection",
    },
  };
}

/** The card map with a synthetic envelope filled in for every failed fetch. */
function mergeFailed(board: Board, cards: Record<string, CardEnvelope>, failed: string[]): Record<string, CardEnvelope> {
  if (failed.length === 0) return cards;
  const merged = { ...cards };
  for (const id of failed) {
    const item = board.items.find((candidate) => candidate.card === id);
    if (item && !merged[id]) merged[id] = failedEnvelope(item);
  }
  return merged;
}

/** Every visible source, in board order, for the strip. */
function stripRows(board: Board, cards: Record<string, CardEnvelope>): HomeRow[] {
  const rows: HomeRow[] = [];
  for (const item of board.items) {
    if (item.hidden) continue;
    const card = cards[item.card];
    if (card) rows.push({ item, card });
  }
  return rows;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="fd-home-section">
      <h2 className="fd-home-section-title">{title}</h2>
      {children}
    </section>
  );
}

function NeedsYouList({ entries }: { entries: Sections["needs_you"] }) {
  if (entries.length === 0) return <p className="fd-home-empty">Nothing for you right now.</p>;
  return (
    <ul className="fd-home-needs-you">
      {entries.map((entry) => (
        <li key={entry.id} className="fd-home-needs-you-item">
          <span className="fd-home-needs-you-text">{entry.text}</span>
          <span className="fd-home-needs-you-source">{entry.source}</span>
          {entry.action.kind === "open" ? (
            <a className="fd-home-action" href={entry.action.href} aria-label={`Open: ${entry.text}`}>
              Open
            </a>
          ) : (
            <button type="button" className="fd-home-action" aria-label={`Approve: ${entry.text}`}>
              Approve
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * C7: the front door. Briefing first, the whole-world strip, then the finite
 * Needs you and the three row sections. Pick up is omitted until it has data.
 * The section model is recomputed only when the loaded data changes, never
 * because of focus or which drill-in is open.
 */
export function Home({ timeZone }: HomeProps) {
  const { board, cards, needsYou, loading, error, failed } = useHomeData();
  const { prefs } = usePrefs();
  const [openId, setOpenId] = useState<string | null>(null);
  const [quietOpen, setQuietOpen] = useState(false);

  // cards and failed are fresh objects each render. Snapshot them by content
  // so openId / quietOpen changes never rebuild the sections.
  const cardsKey = JSON.stringify(cards);
  const failedKey = JSON.stringify(failed);

  const stableCards = useMemo<Record<string, CardEnvelope>>(
    () => JSON.parse(cardsKey) as Record<string, CardEnvelope>,
    [cardsKey],
  );
  const stableFailed = useMemo<string[]>(() => JSON.parse(failedKey) as string[], [failedKey]);

  const augmented = useMemo(
    () => (board ? mergeFailed(board, stableCards, stableFailed) : null),
    [board, stableCards, stableFailed],
  );
  const sections = useMemo(
    () => (board && augmented ? buildSections(board, augmented, needsYou) : null),
    [board, augmented, needsYou],
  );
  const rows = useMemo(() => (board && augmented ? stripRows(board, augmented) : []), [board, augmented]);

  const toggle = (cardId: string) => setOpenId((current) => (current === cardId ? null : cardId));

  if (error) {
    return (
      <div className="fd-home">
        <p className="fd-home-error" role="alert">
          Home could not load. Try again.
        </p>
        <button type="button" className="fd-home-retry" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  }

  if (loading || !sections) {
    return (
      <div className="fd-home">
        <p className="fd-home-loading" role="status">
          Loading Home
        </p>
      </div>
    );
  }

  const { words, density } = prefs;
  const calmQuiet = density === "calm" && !quietOpen;
  const quietlyWorking = sections.quietly_working;

  const renderRow = (row: HomeRow) => (
    <Row
      key={row.item.card}
      item={row.item}
      card={row.card}
      words={words}
      density={density}
      timeZone={timeZone}
      expanded={openId === row.item.card}
      onToggle={() => toggle(row.item.card)}
    />
  );

  return (
    <div className="fd-home">
      <h1 className="fd-home-title">Home</h1>
      <p className="fd-home-briefing">{briefing(sections)}</p>
      <Strip rows={rows} onSelect={toggle} />
      <button type="button" className="fd-home-edit">
        Edit Home
      </button>

      <Section title={SECTION_TITLE.needs_you}>
        <NeedsYouList entries={sections.needs_you} />
      </Section>

      <Section title={SECTION_TITLE.needs_look}>
        {sections.needs_look.length === 0 ? (
          <p className="fd-home-empty">Nothing needs a look. Everything is answering.</p>
        ) : (
          <ul className="fd-home-rows">{sections.needs_look.map(renderRow)}</ul>
        )}
      </Section>

      {sections.your_life.length > 0 && (
        <Section title={SECTION_TITLE.your_life}>
          <ul className="fd-home-rows">{sections.your_life.map(renderRow)}</ul>
        </Section>
      )}

      {quietlyWorking.length > 0 && (
        <Section title={SECTION_TITLE.quietly_working}>
          {calmQuiet ? (
            <p className="fd-home-quiet">
              {`${quietlyWorking.length} quiet: ${quietlyWorking.map((row) => row.item.title).join(", ")}`}{" "}
              <button type="button" className="fd-home-quiet-toggle" onClick={() => setQuietOpen(true)}>
                Show
              </button>
            </p>
          ) : (
            <ul className="fd-home-rows">{quietlyWorking.map(renderRow)}</ul>
          )}
        </Section>
      )}
    </div>
  );
}
