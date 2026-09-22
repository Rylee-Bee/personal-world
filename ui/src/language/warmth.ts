/**
 * C10 — Per-surface warmth-dial SCHEMA STUB. Types only. Zero behaviour.
 *
 * Shape blessed at Staff Meeting #4 (Sol's model, adopted): the render
 * input for one message is `job(1) + context(≤2) + settings(0-1) +
 * warmth(1-7)` (consult M4-3). Warmth may change how a message FEELS;
 * it may never touch the accessibility floor (M4 item 2, adopted as
 * law — "warmth must not control accessibility").
 *
 * THE HONEST GAP (recorded 2026-09-21, overnight Track C): the job
 * taxonomy is frozen at Sol's nine (consult M4-2), but the repository
 * record transcribes only three of the nine by name — `recover`
 * (§A row 1 and consult M4-5), `guide` (§A row 1 / consult M4-2) and
 * `acknowledge` (consult M4-17). The other six live in Sol's external
 * review notes, which are not in this repo. Enumerating them here
 * would be fabrication, so the union below carries only the three
 * named jobs; `WARMTH_TAXONOMY_TOTAL_JOBS` records the frozen size of
 * the real taxonomy and `WARMTH_TAXONOMY_GAP` states what is missing.
 * Completing this union requires Sol's notes, not a guess.
 */

/** Taxonomy size frozen at Staff Meeting #4 consult M4-2. */
export const WARMTH_TAXONOMY_TOTAL_JOBS = 9 as const;

/**
 * Message kinds — one job per message (jobs are mutually exclusive;
 * Staff Meeting #4 consult M4-2 + its 2026-09-21 addendum, which
 * transcribed all nine from Sol's review into the repo record).
 * Each line's comment is Sol's question, verbatim.
 */
export type WarmthJob =
  | "inform" // what happened?
  | "explain" // what does this mean?
  | "guide" // how do I do this?
  | "ask" // what do you need from me?
  | "warn" // what should I know before continuing?
  | "recover" // something went wrong; now what?
  | "reassure" // am I / is my stuff okay?
  | "celebrate" // something good happened
  | "acknowledge"; // recognize something important that happened

/**
 * Situation tags, at most 2 active per render (consult M4-3). Contexts
 * are unbounded in the spec, so this is an open string at the type
 * level — the ≤2 cap is enforced by the (future) renderer contract,
 * not by inventing a closed list here. Examples named in the meeting:
 * security, apology, grief, billing.
 */
export type WarmthContextTag = string;

/** Settings dials (0-1 per message), per Staff Meeting #4 §A row 1. */
export interface WarmthSettings {
  /** "low-bandwidth" — terse presentation; a dial, not a context tag. */
  low_bandwidth: boolean;
}

/** Warmth dial domain: integers 1..7 (Sol's model; M4-4 test matrix). */
export type WarmthLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** The per-message render input shape — D18 spec §1.F family. */
export interface WarmMessageSpec {
  job: WarmthJob;
  contexts: readonly WarmthContextTag[];
  settings?: WarmthSettings;
  warmth: WarmthLevel;
}

/**
 * Nothing is wired. No renderer, no route, no store consumes this
 * module's types at runtime — the only runtime surface is the honest
 * label the Settings preview panel renders while this stays true.
 */
export const WARMTH_UNWIRED = true as const;

/** The single honest label text. Settings preview panel only — never scattered. */
export const WARMTH_UNWIRED_LABEL = "language dials — not yet wired";
