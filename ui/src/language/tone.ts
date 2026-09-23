/**
 * Tone registers for the ONE Worlds voice (TRUE-NORTH § Voice, owner
 * ruling 2026-09-22 — Wave 1 Lane B).
 *
 * One voice speaks across chat and attention surfaces; the person
 * picks its *tone register*: warm (default) · concise · playful ·
 * formal. The registers change phrasing and emotional volume — never
 * facts, never the accessibility floor, and never the honesty of a
 * degraded state (PRODUCT-LANGUAGE.md principle 3: warm in tone,
 * exact in facts).
 *
 * The residents / two-voice system lives on as the optional personality
 * pack (`personality_pack` pref, off by default; canon kept in
 * docs/CHARACTER-HANDBOOK.md + docs/COMPANION-CANON.md). The server
 * gates the pack's prompt routing (src/personal_world/voice.py); this
 * module owns the client-side tone vocabulary.
 *
 * The register vocabulary mirrors the server's closed set exactly
 * (src/personal_world/prefs.py TONE): a value the server does not
 * describe is never rendered — parseTone degrades it to warm.
 */

import { SIGNAL_LABELS, type WorldSignalLevel } from "../data/types";

export type ToneRegister = "warm" | "concise" | "playful" | "formal";

/** The server's closed vocabulary, in server order (prefs.py TONE). */
export const TONE_REGISTERS: readonly ToneRegister[] = [
  "warm",
  "concise",
  "playful",
  "formal",
];

export const DEFAULT_TONE: ToneRegister = "warm";

/** Narrow an unknown wire value to a register; anything else is warm.
 *  Never invents a register the server did not offer. */
export function parseTone(value: unknown): ToneRegister {
  return typeof value === "string" &&
    (TONE_REGISTERS as readonly string[]).includes(value)
    ? (value as ToneRegister)
    : DEFAULT_TONE;
}

/**
 * Attention-voice labels per register — the emotional volume settings
 * (CHARACTER-HANDBOOK §11) spoken in the active tone. Rules:
 *
 *  - warm IS the existing SIGNAL_LABELS, byte-identical, so the
 *    default rendering never shifts;
 *  - every register labels all four levels in words (§1.3 — never
 *    colour alone), and `critical` always says plainly that attention
 *    is needed: a tone may quiet the phrasing, never the urgency;
 *  - these are labels, not data: the headline sentence and the raw
 *    wire string behind the disclosure stay untouched by tone.
 */
const TONE_SIGNAL_LABELS: Record<ToneRegister, Record<WorldSignalLevel, string>> =
  {
    warm: SIGNAL_LABELS,
    concise: {
      good: "Good",
      update: "Update",
      waiting: "Waiting",
      critical: "Action needed",
    },
    playful: {
      good: "Good news!",
      update: "A little something new",
      waiting: "Whenever you're ready",
      critical: "This one needs you",
    },
    formal: {
      good: "Positive status",
      update: "An update",
      waiting: "Awaiting your review",
      critical: "Attention required",
    },
  };

export function toneSignalLabels(
  tone: ToneRegister,
): Record<WorldSignalLevel, string> {
  return TONE_SIGNAL_LABELS[tone] ?? SIGNAL_LABELS;
}

/** The tone the document currently carries. prefs-dom writes
 *  `data-pw-tone` on <html> when server prefs land (C12 chrome); an
 *  absent or unrecognised attribute means the default (warm). A plain
 *  DOM read on purpose: attention cards stay renderable anywhere —
 *  stories, bare component tests — with no query context required. */
export function activeToneRegister(): ToneRegister {
  if (typeof document === "undefined") return DEFAULT_TONE;
  return parseTone(document.documentElement.getAttribute("data-pw-tone"));
}

// ─── Chat surface copy per register ─────────────────────────
//
// Static Chat-screen sentences in the active tone. The honest-off
// rules are unchanged: `unavailableHeading` LABELS the degraded state
// (never softens it), and the server's exact reason string always
// renders beside it.

export interface ChatToneCopy {
  empty: string;
  thinking: string;
  unavailableHeading: string;
}

const CHAT_TONE_COPY: Record<ToneRegister, ChatToneCopy> = {
  warm: {
    empty: "Start a conversation with your world assistant.",
    thinking: "Thinking…",
    unavailableHeading: "Chat is not available right now.",
  },
  concise: {
    empty: "Ask about your world.",
    thinking: "Working…",
    unavailableHeading: "Chat unavailable.",
  },
  playful: {
    empty: "Say hello — your world is listening.",
    thinking: "Thinking…",
    unavailableHeading: "Chat can't answer right now — here's exactly why.",
  },
  formal: {
    empty: "Begin a conversation with the world assistant.",
    thinking: "Processing…",
    unavailableHeading: "The chat service is currently unavailable.",
  },
};

export function chatToneCopy(tone: ToneRegister): ChatToneCopy {
  return CHAT_TONE_COPY[tone] ?? CHAT_TONE_COPY[DEFAULT_TONE];
}
