import type { Meter as MeterData } from "./types";
import "./fd.css";

export interface MeterProps {
  meter: MeterData | null;
  frozen: boolean;
}

/** Clamp a count into [0, total] so an off-by-one upstream can never draw extra marks. */
function clamp(n: number, total: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(total, Math.round(n)));
}

function Segments({ meter }: { meter: Extract<MeterData, { type: "segments" }> }) {
  const total = Math.max(0, Math.round(meter.total));
  const filled = clamp(meter.filled, total);
  return (
    <span className="fd-meter-parts">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < filled ? "fd-meter-seg fd-meter-seg--on" : "fd-meter-seg"} />
      ))}
    </span>
  );
}

function Bars({ meter }: { meter: Extract<MeterData, { type: "bars" }> }) {
  const max = meter.max !== undefined && meter.max > 0 ? meter.max : Math.max(1, ...meter.values);
  return (
    <span className="fd-meter-bars">
      {meter.values.map((value, i) => {
        const pct = Math.max(0, Math.min(100, (value / max) * 100));
        return <span key={i} className="fd-meter-bar" style={{ height: `${pct}%` }} />;
      })}
    </span>
  );
}

function Progress({ meter }: { meter: Extract<MeterData, { type: "progress" }> }) {
  const pct = meter.max > 0 ? Math.max(0, Math.min(100, (meter.value / meter.max) * 100)) : 0;
  return (
    <span className="fd-meter-progress">
      <span className="fd-meter-progress-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

function Marks({ meter }: { meter: Extract<MeterData, { type: "marks" }> }) {
  const shown = Math.max(0, Math.round(meter.shown));
  const more = Math.max(0, Math.round(meter.more));
  return (
    <span className="fd-meter-parts">
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className="fd-meter-mark" />
      ))}
      {more > 0 && <span className="fd-meter-more">{`+${more} more`}</span>}
    </span>
  );
}

function Dots({ meter }: { meter: Extract<MeterData, { type: "dots" }> }) {
  const total = Math.max(0, Math.round(meter.total));
  const on = clamp(meter.on, total);
  return (
    <span className="fd-meter-parts">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < on ? "fd-meter-dot fd-meter-dot--on" : "fd-meter-dot"} />
      ))}
    </span>
  );
}

/** Minutes since midnight for an "HH:MM" label, or null when it cannot be read. */
function dayPosition(at: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(at);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return ((hours * 60 + minutes) / (24 * 60)) * 100;
}

function Day({ meter }: { meter: Extract<MeterData, { type: "day" }> }) {
  return (
    <span className="fd-meter-day">
      <span className="fd-meter-day-track">
        {meter.events.map((event, i) => {
          const pos = dayPosition(event.at);
          return pos === null ? null : (
            <span key={i} className="fd-meter-day-mark" style={{ left: `${pos}%` }} />
          );
        })}
      </span>
      <span className="fd-meter-day-labels">
        {meter.events.map((event, i) => (
          <span key={i} className="fd-meter-day-label">
            <span className="fd-meter-day-time">{event.at}</span>
            <span>{event.label}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

function Shelf({ meter }: { meter: Extract<MeterData, { type: "shelf" }> }) {
  return (
    <span className="fd-meter-shelf">
      {meter.items.map((item, i) => (
        <span key={i} className="fd-meter-shelf-item">
          {item}
        </span>
      ))}
    </span>
  );
}

function MeterBody({ meter }: { meter: MeterData }) {
  switch (meter.type) {
    case "segments":
      return <Segments meter={meter} />;
    case "bars":
      return <Bars meter={meter} />;
    case "progress":
      return <Progress meter={meter} />;
    case "marks":
      return <Marks meter={meter} />;
    case "dots":
      return <Dots meter={meter} />;
    case "day":
      return <Day meter={meter} />;
    case "shelf":
      return <Shelf meter={meter} />;
    default:
      return null;
  }
}

/**
 * One visual meter. The whole thing is a single image to assistive tech: the
 * text equivalent is the name, the drawn marks are presentational, and the
 * meter never animates. Frozen draws a striped, dashed "last good" treatment.
 */
export function Meter({ meter, frozen }: MeterProps) {
  if (!meter) return null;
  return (
    <span
      className={`fd-meter fd-meter--${meter.type}${frozen ? " fd-meter--frozen" : ""}`}
      role="img"
      aria-label={meter.text_equivalent}
      data-frozen={frozen ? "true" : undefined}
    >
      <MeterBody meter={meter} />
    </span>
  );
}
