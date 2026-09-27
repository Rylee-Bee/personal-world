/**
 * One sticker in the album (owner ask, 2026-09-27; design: the Worlds
 * Sticker Album). A die-cut sticker with a white edge, slightly tilted, in
 * one of three shines: paper for everyday things, gold foil for learning
 * milestones, holo for the deepest secrets. No rarity numbers anywhere.
 *
 * States, always said in words as well as shown:
 * - found: its art and name, and its shine;
 * - not yet (open): its name, faded, so you know what to go and do;
 * - riddle: a striped blank with a question mark; the name stays hidden;
 * - secret: never drawn until found; then a dark foil sticker with a small
 *   "secret" corner.
 *
 * The holo shimmer moves only where motion is allowed; with reduced motion
 * it holds still. A press turns the sticker over (the caller shows its back).
 */
import type { CSSProperties } from "react";
import { tiltFor } from "./tilt";

export type StickerKind = "open" | "riddle" | "secret";
export type StickerShine = "paper" | "foil" | "holo";
export type StickerShape = "circle" | "star" | "tag" | "book";

export interface StickerProps {
  id: string;
  /** Hidden for a riddle until found. */
  name: string;
  kind: StickerKind;
  shine: StickerShine;
  shape?: StickerShape;
  found: boolean;
  /** The picture (text-free, die-cut); a soft emblem when there isn't one yet. */
  art?: string | null;
  /** Where it was stuck: a small turn in degrees (otherwise one from its id). */
  tilt?: number;
  onTurnOver?: () => void;
  size?: number;
}


function stateWords(p: StickerProps): string {
  if (p.found) return `${p.shine === "paper" ? "Paper" : p.shine === "foil" ? "Gold foil" : "Holo"}${p.kind === "secret" ? " · secret" : ""}`;
  return p.kind === "riddle" ? "Riddle" : "Not yet";
}

export function Sticker(p: StickerProps) {
  const { found, kind, shape = "circle", size = 96 } = p;
  const label = !found && kind === "riddle" ? "A riddle" : p.name;
  const look = found ? `sticker-${p.shine}` : kind === "riddle" ? "sticker-riddle" : "sticker-locked";
  return (
    <button
      type="button"
      onClick={p.onTurnOver}
      className={`sticker sticker-shape-${shape} ${look} ${found && kind === "secret" ? "sticker-secret" : ""}`}
      style={{ "--sticker-tilt": `${p.tilt ?? tiltFor(p.id)}deg`, "--sticker-size": `${size}px` } as CSSProperties}
      aria-label={`${label}${found ? ", found" : kind === "riddle" ? "" : ", not found yet"}. Turn it over.`}
      data-found={found ? "true" : "false"}
      data-kind={kind}
    >
      <span className="sticker-die" aria-hidden="true">
        {found && p.art ? (
          <img src={p.art} alt="" className="sticker-art" />
        ) : !found && kind === "riddle" ? (
          <span className="sticker-mark">?</span>
        ) : (
          <span className="sticker-mark">{p.name.trim().charAt(0).toUpperCase() || "?"}</span>
        )}
        {found && kind === "secret" ? <span className="sticker-corner">secret</span> : null}
      </span>
      <span className="sticker-name">{label}</span>
      <span className="sticker-state">{stateWords(p)}</span>
    </button>
  );
}

/** The album's paper page: stickers sit on it in a loose grid. */
export function StickerSheet({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <ul className="sticker-sheet" aria-label={label}>
      {Array.isArray(children) ? children.map((c, i) => <li key={i}>{c}</li>) : <li>{children}</li>}
    </ul>
  );
}
