import { STATE_SHAPE } from "./types";
// The home-model Row clashes with the Row component in name only; alias it.
import type { Row as HomeRow } from "./home-model";
import "./fd.css";

export interface StripProps {
  rows: HomeRow[];
  onSelect: (cardId: string) => void;
}

/** Decorative glyph per source icon, matching the Row glyphs. Never focusable. */
const ICONS: Record<string, string> = {
  sun: "☀",
  book: "▤",
  bookmark: "❑",
  music: "♪",
  download: "⤓",
  archive: "▣",
  calendar: "▦",
  disk: "◔",
  check: "✓",
};

function glyph(icon: string): string {
  return ICONS[icon] ?? "◆";
}

/**
 * C4: one source in the whole-world strip. A normal source is a button that
 * opens its drill-in; a not_configured source is a link into Connect. The
 * accessible name carries the sentence ("Name: State. action"); the visible
 * content stays icon, name and shape + word.
 */
function StripItem({ row, onSelect }: { row: HomeRow; onSelect: (cardId: string) => void }) {
  const { item, card } = row;
  const state = STATE_SHAPE[card.source_state];
  const notConfigured = card.source_state === "not_configured";
  const label = notConfigured
    ? `${item.title}: ${state.word}. Set up in Connect`
    : `${item.title}: ${state.word}. Show details`;

  const body = (
    <>
      <span className="fd-strip-icon" aria-hidden="true">
        {glyph(item.icon)}
      </span>
      <span className="fd-strip-name">{item.title}</span>
      <span className="fd-strip-state">
        <span className="fd-strip-shape" aria-hidden="true">
          {state.shape}
        </span>
        <span className="fd-strip-word">{state.word}</span>
      </span>
    </>
  );

  if (notConfigured) {
    return (
      <a className="fd-strip-item" href="#connect" aria-label={label}>
        {body}
      </a>
    );
  }
  return (
    <button type="button" className="fd-strip-item" aria-label={label} onClick={() => onSelect(item.card)}>
      {body}
    </button>
  );
}

/** C4: the whole world at a glance, in board order, as one control per source. */
export function Strip({ rows, onSelect }: StripProps) {
  return (
    <div className="fd-strip" role="group" aria-label="Whole world">
      {rows.map((row) => (
        <StripItem key={row.item.card} row={row} onSelect={onSelect} />
      ))}
    </div>
  );
}
