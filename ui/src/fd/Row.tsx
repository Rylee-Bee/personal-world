import type { ReactNode } from "react";
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
  /** Visual weight: 1 needs a look (loud), 2 your life, 3 quietly working. */
  tier?: 1 | 2 | 3;
  /** Edit Home controls, rendered at the foot of the row. */
  controls?: ReactNode;
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

function Meaning({ words, card, title }: { words: Words; card: CardEnvelope; title: string }) {
  if (words === "minimal") return null;
  const text = words === "full" ? card.meaning.full : card.meaning.short;
  // The card's own meaning, never the name said twice.
  if (!text || text.trim().toLowerCase() === title.trim().toLowerCase()) return null;
  return <span className="fd-row-meaning">{text}</span>;
}

function evidenceRows(card: CardEnvelope): { key: string; value: string | number }[] {
  const e = card.evidence;
  const candidates: [string, string | number | undefined][] = [
    ["request_id", e.request_id || undefined],
    ["method", e.method || undefined],
    ["path", e.path || undefined],
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
 * One Home row: icon, a disclosure button holding the name and meaning, the meter, value + unit
 * (kept together), state shape + word and freshness. Expanding renders the drill-in in place.
 * The whole row is the click target (the button stretches over it); the drill-in sits above.
 */
export function Row({ item, card, words, density, timeZone, expanded, onToggle, tier = 2, controls }: RowProps) {
  const { text: valueText, present, unit } = readPrimary(item, card);
  const state = STATE_SHAPE[card.source_state];
  const frozen = card.freshness === "stale" || card.source_state === "unavailable" || card.source_state === "stale";
  // Quietly working rows carry no meter unless the owner chose Detailed.
  const showMeter = !!card.meter && (tier !== 3 || density === "detailed");
  const problem = card.source_state !== "healthy" || card.freshness === "stale";

  // A row with a problem always says when it was last good. Healthy rows say it only in Full.
  let freshness: { visible: string; hidden?: string } | null = null;
  if (problem) {
    const at = card.last_good_at ?? card.observed_at;
    const clock = at ? formatClock(at, timeZone) : null;
    freshness = clock ? { visible: `Last good ${clock}` } : { visible: "Last good —", hidden: "Last good: never" };
  } else if (words === "full") {
    freshness = { visible: "Current" };
  }
  const freshnessNode = freshness && (
    <span className="fd-row-freshness">
      {freshness.hidden ? (
        <>
          <span aria-hidden="true">{freshness.visible}</span>
          <span className="fd-sr">{freshness.hidden}</span>
        </>
      ) : (
        freshness.visible
      )}
    </span>
  );

  const values = Object.entries(card.values);
  const evidence = evidenceRows(card);
  const regionLabel = `${item.title} details`;
  const label = (key: string) => item.fields.find((f) => f.key === key)?.label ?? key;
  const cls = ["fd-row", `fd-row--t${tier}`, item.size === "S" ? "fd-row--slim" : item.size === "L" ? "fd-row--l" : "", showMeter ? "" : "fd-row--nometer", card.source_state === "unavailable" ? "is-bad" : "", card.source_state === "degraded" ? "is-degraded" : "", expanded ? "is-open" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={cls} id={`fd-row-${item.card}`}>
      <span className="fd-row-icon" aria-hidden="true">
        {glyph(item.icon)}
      </span>
      <button type="button" className="fd-row-name" aria-expanded={expanded} onClick={onToggle}>
        <span className="fd-row-title">{item.title}</span>
        <Meaning words={words} card={card} title={item.title} />
      </button>
      {showMeter && (
        <span className="fd-row-meter">
          <Meter meter={card.meter} frozen={frozen} />
        </span>
      )}
      <span className="fd-row-val">
        <span className="fd-row-value">
          {present ? (
            valueText
          ) : (
            <>
              <span aria-hidden="true">{valueText}</span>
              <span className="fd-sr">unknown</span>
            </>
          )}
        </span>
        {present && unit && <span className="fd-row-unit">{unit}</span>}
      </span>
      <span className="fd-row-status">
        <span className="fd-row-state">
          <span className="fd-row-shape" aria-hidden="true">
            {state.shape}
          </span>
          <span className="fd-row-state-word">{state.word}</span>
        </span>
        {freshnessNode}
      </span>
      {expanded && (
        <section className="fd-row-details" role="region" aria-label={regionLabel}>
          <p className="fd-row-detail-meaning">{card.meaning.full || card.meaning.short || item.title}</p>
          <p className="fd-row-detail-state">
            <span aria-hidden="true">{state.shape}</span> <span>{state.word}</span>
          </p>
          <dl className="fd-row-detail-values">
            {values.map(([key, value]) => (
              <div key={key} className="fd-row-detail-value">
                <dt>{label(key)}</dt>
                <dd>{value.text}</dd>
              </div>
            ))}
          </dl>
          {freshness && <p className="fd-row-detail-freshness">{freshnessNode}</p>}
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
      {controls}
    </li>
  );
}
