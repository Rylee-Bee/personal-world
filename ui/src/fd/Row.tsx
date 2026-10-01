import { STATE_SHAPE, type BoardItem, type CardEnvelope, type Density, type Words } from "./types";
import { Meter } from "./Meter";
import "./fd.css";

export interface RowProps {
  item: BoardItem;
  card: CardEnvelope;
  words: Words;
  density: Density;
  /** Passed to Intl.DateTimeFormat for clock times; omitted means the host zone. */
  timeZone?: string;
  expanded: boolean;
  onToggle: () => void;
}

/** Decorative glyph per source icon. A plain placeholder is fine; never focusable. */
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

function formatClock(iso: string, timeZone?: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
}

/** C2.1: a value is missing when it is absent, or "unknown" with no raw. Never 0. */
function readPrimary(item: BoardItem, card: CardEnvelope): { text: string; present: boolean; unit?: string } {
  const field = item.fields[0];
  const entry = field ? card.values[field.key] : undefined;
  if (entry === undefined || (entry.text === "unknown" && entry.raw === undefined)) {
    return { text: "—", present: false };
  }
  return { text: entry.text, present: true, unit: field?.unit };
}

function Meaning({ words, card }: { words: Words; card: CardEnvelope }) {
  if (words === "minimal") return null;
  return <span className="fd-row-meaning">{words === "full" ? card.meaning.full : card.meaning.short}</span>;
}

function evidenceRows(card: CardEnvelope): { key: string; value: string | number }[] {
  const e = card.evidence;
  const candidates: [string, string | number | undefined][] = [
    ["request_id", e.request_id],
    ["method", e.method],
    ["path", e.path],
    ["status_code", e.status_code],
    ["duration_ms", e.duration_ms],
    ["error_class", e.error_class],
    ["note", e.note],
  ];
  return candidates
    .filter((pair): pair is [string, string | number] => pair[1] !== undefined)
    .map(([key, value]) => ({ key, value }));
}

/**
 * One Home row: a disclosure button holding the icon, name and meaning, the
 * meter, value, unit, state shape + word and freshness. Expanding renders the
 * drill-in region in place.
 */
export function Row({ item, card, words, density, timeZone, expanded, onToggle }: RowProps) {
  const { text: valueText, present, unit } = readPrimary(item, card);
  const state = STATE_SHAPE[card.source_state];
  const frozen = card.freshness === "stale" || card.source_state === "unavailable" || card.source_state === "stale";

  let freshnessText: string | null = null;
  if (card.freshness === "stale") {
    const at = card.last_good_at ?? card.observed_at;
    const clock = at ? formatClock(at, timeZone) : null;
    if (clock) freshnessText = `as of ${clock}`;
  } else if (words === "full") {
    freshnessText = "Current";
  }

  const values = Object.entries(card.values);
  const evidence = evidenceRows(card);
  const regionLabel = `${item.title} details`;

  return (
    <li className={`fd-row${item.size === "S" ? " fd-row--slim" : ""}`}>
      <button type="button" className="fd-row-name" aria-expanded={expanded} onClick={onToggle}>
        <span className="fd-row-icon" aria-hidden="true">
          {glyph(item.icon)}
        </span>
        <span className="fd-row-titles">
          <span className="fd-row-title">{item.title}</span>
          <Meaning words={words} card={card} />
        </span>
      </button>
      {card.meter && <Meter meter={card.meter} frozen={frozen} />}
      <span className="fd-row-value">{valueText}</span>
      {present && unit && <span className="fd-row-unit">{unit}</span>}
      <span className="fd-row-state">
        <span className="fd-row-shape" aria-hidden="true">
          {state.shape}
        </span>
        <span className="fd-row-state-word">{state.word}</span>
      </span>
      {freshnessText && <span className="fd-row-freshness">{freshnessText}</span>}
      {expanded && (
        <section className="fd-row-details" role="region" aria-label={regionLabel}>
          <p className="fd-row-detail-meaning">{card.meaning.full}</p>
          <p className="fd-row-detail-state">
            <span aria-hidden="true">{state.shape}</span> <span>{state.word}</span>
          </p>
          <dl className="fd-row-detail-values">
            {values.map(([key, value]) => (
              <div key={key} className="fd-row-detail-value">
                <dt>{key}</dt>
                <dd>{value.text}</dd>
              </div>
            ))}
          </dl>
          {freshnessText && <p className="fd-row-detail-freshness">{freshnessText}</p>}
          <details className="fd-row-evidence" open={density === "detailed"}>
            <summary>Technical evidence</summary>
            <ul>
              {evidence.map((row) => (
                <li key={row.key}>
                  {row.key}: {row.value}
                </li>
              ))}
            </ul>
          </details>
          <a className="fd-row-connect" href="#connect">
            Open in Connect
          </a>
        </section>
      )}
    </li>
  );
}
