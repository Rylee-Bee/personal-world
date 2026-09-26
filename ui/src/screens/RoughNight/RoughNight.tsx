/**
 * RoughNight — the calmest page in the app (owner wish, 2026-09-26).
 *
 * For a hard pain night: very dim, big targets, one-handed, few words,
 * and NO motion at all — no transition or animation utility lives on
 * this screen, whatever the applied theme, motion pref or OS setting
 * says (the kit's global motion floors still hold underneath it).
 *
 * The look is the kit's darkest pack, forced regardless of the chosen
 * theme: the region carries `data-theme` itself (the same nesting the
 * Settings theme swatches use to show one pack inside another), so
 * every --pw-* token below resolves deep and quiet while the person's
 * own theme is left untouched everywhere else. Body text rides
 * --pw-text-secondary, which clears 4.5:1 on every surface of every
 * dark pack (and the muted rung clears it on canvas and panel).
 *
 * Shape: one soft line from the person's companion (the same keeper
 * resident the Bridge speaks through — no name when nobody was
 * chosen), "How bad is it?" with five big one-column buttons
 * (aria-pressed), an optional note, and one write only:
 * POST /api/journal {text} with the plain line a doctor can scan.
 * "Back" returns to the Bridge. No images but the companion portrait,
 * dimmed; no badges, no counts, no notification prompts.
 */

import { useState } from "react";
import { writeJournal } from "../../data/api";
import { useBriefing } from "../../data/hooks";
import { CompanionFace } from "../../components/crew/CompanionFace";

const LEVELS: readonly { value: number; label: string }[] = [
  { value: 1, label: "1 · A little" },
  { value: 2, label: "2 · Hard to ignore" },
  { value: 3, label: "3 · Bad" },
  { value: 4, label: "4 · Very bad" },
  { value: 5, label: "5 · The worst" },
];

/** public/ files are copied verbatim; join against the deploy base
 *  exactly like the Bridge's companion face does. */
function publicAsset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}

/** The one journal line, shaped exactly:
 *  "Rough night · <n>/5 · <local time HH:MM> · <note if any> #rough-night"
 *  — local clock time, zero-padded 24 h; the note segment joins only
 *  when the person wrote something. */
export function roughNightText(level: number, note: string, at: Date): string {
  const hh = String(at.getHours()).padStart(2, "0");
  const mm = String(at.getMinutes()).padStart(2, "0");
  const trimmed = note.trim();
  const parts = [`Rough night`, `${level}/5`, `${hh}:${mm}`];
  if (trimmed) parts.push(trimmed);
  return `${parts.join(" · ")} #rough-night`;
}

export function RoughNight({ onBack }: { onBack: () => void }) {
  const briefing = useBriefing();
  // The same keeper resident the Bridge gets its companion from;
  // key === null is Worlds' plain voice — then the line has no name.
  const speaker = briefing.data?.data?.keeper?.resident ?? null;
  const hasCompanion = speaker !== null && speaker.key !== null;

  const [level, setLevel] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    if (level === null || saving) return;
    setSaving(true);
    try {
      const answer = await writeJournal({
        text: roughNightText(level, note, new Date()),
      });
      setStatus(
        answer.ok === true
          ? "Saved to your journal."
          : "Couldn’t save. Try again when you’re ready.",
      );
    } catch {
      setStatus("Couldn’t save. Try again when you’re ready.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      id="main-content"
      aria-label="Rough night"
      data-theme="ocean"
      className="relative z-10 min-h-[calc(100vh-112px)] bg-[var(--pw-surface-canvas)] px-[var(--pw-spacing-xl)] pt-[var(--pw-spacing-3xl)] pb-[calc(var(--pw-spacing-4xl)_+_var(--pw-safe-area-inset-bottom))] max-w-[560px]"
    >
      <h1 className="text-[length:var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-secondary)]">
        Rough night
      </h1>

      {/* 1 · One soft line from the companion — a character line, so
          the voice is allowed; no name when nobody was chosen. */}
      <div className="mt-[var(--pw-spacing-xl)] flex items-center gap-[var(--pw-spacing-md)]">
        {hasCompanion && speaker.portrait !== null && (
          <CompanionFace
            name={speaker.name}
            portrait={publicAsset(speaker.portrait)}
            size="md"
            dim
          />
        )}
        <p className="min-w-0 text-[length:var(--pw-typography-size_lead)] text-[var(--pw-text-secondary)]">
          {hasCompanion && <b>{`${speaker.name}: `}</b>}
          I’m here. Nothing needs you tonight.
        </p>
      </div>

      {/* 2 · How bad — five large buttons, one column, one tap each. */}
      <h2
        id="rough-night-level-heading"
        className="mt-[var(--pw-spacing-3xl)] text-[length:var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-secondary)]"
      >
        How bad is it?
      </h2>
      <div
        role="group"
        aria-labelledby="rough-night-level-heading"
        className="mt-[var(--pw-spacing-md)] flex flex-col gap-[var(--pw-spacing-sm)]"
      >
        {LEVELS.map((levelOption) => {
          const pressed = level === levelOption.value;
          return (
            <button
              key={levelOption.value}
              type="button"
              aria-pressed={pressed}
              onClick={() => {
                setLevel(levelOption.value);
                setStatus(null);
              }}
              className={[
                "flex min-h-[var(--pw-targets-large)] w-full items-center rounded-[var(--pw-radius-sm)] border px-[var(--pw-spacing-lg)] text-left text-[length:var(--pw-typography-size_lead)]",
                pressed
                  ? "border-[var(--pw-accent-primary)] bg-[var(--pw-surface-raised)] text-[var(--pw-text-primary)]"
                  : "border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] text-[var(--pw-text-secondary)] hover:bg-[var(--pw-surface-elevated)]",
                "focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]",
              ].join(" ")}
            >
              {levelOption.label}
            </button>
          );
        })}
      </div>

      {/* 3 · An optional note. */}
      <label
        htmlFor="rough-night-note"
        className="mt-[var(--pw-spacing-2xl)] block text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-secondary)]"
      >
        Anything else? (optional)
      </label>
      <textarea
        id="rough-night-note"
        rows={3}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        className="mt-[var(--pw-spacing-sm)] w-full min-w-0 resize-y rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-secondary)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
      />

      {/* 4 · The one write on this page. */}
      <button
        type="button"
        onClick={() => void save()}
        disabled={level === null || saving}
        className="mt-[var(--pw-spacing-2xl)] flex min-h-[var(--pw-targets-large)] w-full items-center justify-center rounded-[var(--pw-radius-sm)] bg-[var(--pw-accent-primary)] px-[var(--pw-spacing-lg)] text-[length:var(--pw-typography-size_lead)] font-medium text-[var(--pw-accent-on_primary)] disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
      >
        {saving ? "Saving…" : "Save for my doctor"}
      </button>
      <p
        role="status"
        className="mt-[var(--pw-spacing-md)] min-h-[1.5em] text-[length:var(--pw-typography-size_lead)] text-[var(--pw-text-secondary)]"
      >
        {status ?? ""}
      </p>

      {/* 5 · Back to the Bridge. */}
      <button
        type="button"
        onClick={onBack}
        className="mt-[var(--pw-spacing-xl)] inline-flex min-h-[var(--pw-targets-large)] items-center text-[length:var(--pw-typography-size_lead)] text-[var(--pw-text-secondary)] underline decoration-[var(--pw-border-strong)] underline-offset-4 hover:text-[var(--pw-text-primary)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
      >
        Back
      </button>
    </main>
  );
}
