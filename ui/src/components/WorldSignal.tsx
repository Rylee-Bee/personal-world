/**
 * WorldSignal — Semantic signal indicator.
 *
 * Communicates urgency through text, NOT color alone (accessibility contract §1.3).
 * Each level has an explicit human label.
 *
 * The label is spoken in the active tone register of the ONE voice
 * (TRUE-NORTH § Voice, W1-B): `tone` prop wins, else the document's
 * applied `data-pw-tone` (language/tone.ts), else the warm default —
 * which is byte-identical to the historical SIGNAL_LABELS. A tone may
 * rephrase a label; it never removes one, and `critical` always says
 * plainly that attention is needed.
 *
 * Luminance ranking (brighter = more urgent):
 *   good → subtle
 *   update → slightly brighter
 *   waiting → brighter
 *   critical → brightest
 */

import type { WorldSignalLevel } from "../data/types";
import type { ToneRegister } from "../language/tone";
import { activeToneRegister, toneSignalLabels } from "../language/tone";

interface WorldSignalProps {
  level: WorldSignalLevel;
  title: string;
  description?: string;
  /** Raw server string behind an honest detail disclosure — the
   * technical depth is on demand, never forced (PRODUCT-LANGUAGE.md),
   * and never hidden: it stays one tap away on the card itself. */
  technical?: string;
  /** Optional explicit register; defaults to the tone applied on the
   * document (server-truth prefs). */
  tone?: ToneRegister;
}

const levelStyles: Record<WorldSignalLevel, string> = {
  good: "bg-[var(--pw-accent-teal_soft)] border-[var(--pw-accent-teal)]",
  update:
    "bg-[var(--pw-accent-warm_soft)] border-[var(--pw-accent-warm)]",
  waiting:
    "bg-[var(--pw-accent-gold_soft)] border-[var(--pw-accent-gold)]",
  critical:
    "bg-[var(--pw-accent-coral_soft)] border-[var(--pw-accent-coral)]",
};

// Luminance-only rank indicator — no hue, just brightness
const rankDot: Record<WorldSignalLevel, string> = {
  good: "bg-white/20",
  update: "bg-white/35",
  waiting: "bg-white/55",
  critical: "bg-white/80",
};

export function WorldSignal({ level, title, description, technical, tone }: WorldSignalProps) {
  const labels = toneSignalLabels(tone ?? activeToneRegister());
  return (
    <div
      className={`rounded-[var(--pw-radius-md)] border p-[var(--pw-spacing-lg)] ${levelStyles[level]}`}
      role="status"
    >
      <div className="flex items-start gap-[var(--pw-spacing-md)]">
        {/* Luminance-only rank dot — never the sole signal */}
        <span
          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${rankDot[level]}`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[length:var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]">
            <span className="sr-only">{labels[level]}: </span>
            {title}
          </p>
          {description && (
            <p className="mt-1 text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
              {description}
            </p>
          )}
          {technical && (
            <details className="mt-2">
              <summary className="inline-block cursor-pointer text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]">
                Technical detail
              </summary>
              <code className="mt-1 block break-all font-mono text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-secondary)]">
                {technical}
              </code>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
