/**
 * How to be taught (a person setting): Teach me as I build · Occasional
 * tips · Just plain words. Stored per person by /api/learning/mode.
 */
import { useId, useState } from "react";
import { useLearning, useLearningMode } from "../../data/hooks";
import type { LearningMode } from "../../data/api";
import { BookGirl } from "./BookGirl";

const MODES: { id: LearningMode; label: string; words: string }[] = [
  { id: "build", label: "Teach me as I build", words: "Book Girl offers the name for something you just made, whenever there is one." },
  { id: "occasional", label: "Occasional tips", words: "At most one a day." },
  { id: "plain", label: "Just plain words", words: "No names offered. The words are still there to tap if you want them." },
];

const CHIP_ON =
  "inline-flex min-h-[var(--pw-targets-minimum)] items-center rounded-full border border-[var(--pw-accent-warm)] bg-[var(--pw-accent-warm_soft)] px-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]";
const CHIP_OFF =
  "inline-flex min-h-[var(--pw-targets-minimum)] items-center rounded-full border border-[var(--pw-border-subtle)] px-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]";

export function LearningModeSetting() {
  const learning = useLearning();
  const setMode = useLearningMode();
  const [said, setSaid] = useState<string | null>(null);
  const id = useId();
  const mode = learning.data?.data?.mode ?? null;
  const current = MODES.find((m) => m.id === mode);

  return (
    <div className="flex flex-col gap-[var(--pw-spacing-md)]">
      <div className="flex items-start gap-[var(--pw-spacing-md)]">
        <BookGirl pose="resting" size={56} />
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          Book Girl is a little flying book. When you make something that has a name designers use, she can tell you the
          word, after you’ve made it. Tap her if you want; ignore her if you don’t.
        </p>
      </div>
      {learning.isPending ? (
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">Reading your choice…</p>
      ) : learning.isError ? (
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">Couldn’t read this setting just now.</p>
      ) : (
        <>
          <div role="group" aria-labelledby={`${id}-l`} className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
            <span id={`${id}-l`} className="sr-only">How to be taught</span>
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={mode === m.id}
                disabled={setMode.isPending}
                onClick={() =>
                  setMode.mutate(m.id, {
                    onSuccess: () => setSaid(`Saved: ${m.label.toLowerCase()}.`),
                    onError: () => setSaid("Couldn’t save that just now; nothing changed."),
                  })
                }
                className={mode === m.id ? CHIP_ON : CHIP_OFF}
              >
                {m.label}
              </button>
            ))}
          </div>
          {current ? <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">{current.words}</p> : null}
        </>
      )}
      <p role="status" className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-primary)]">
        {said}
      </p>
    </div>
  );
}
