/**
 * A Book Girl moment: teach while building (owner, 2026-09-27). When a
 * person makes something that has a professional name, she offers the word
 * after they've made it. Recognition, never correction.
 *
 * - She flutters beside the reply (holding still and glowing with reduced
 *   motion). Ignorable, like a fairy guide: nothing pops up.
 * - Tapped, she lands, folds her wings, and opens a small card: first
 *   time, "There's a name for part of what you just made"; later, "You've
 *   seen this idea before. Remember …?". [Why designers use this] opens the
 *   next page of the idea's book; [Got it] closes it and tells Worlds.
 * - Ignored, she settles down on her own after a while, and nothing is
 *   counted.
 * - Familiar ideas and "just plain words" show nothing here.
 *
 * The words come from the idea's book on the "Words for what you make"
 * shelf (docs/library/concepts), so the card and the Library never drift.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { LearningMoment } from "../../data/api";
import { worldsLibrary } from "../../data/library";
import { useLearningGotIt } from "../../data/hooks";
import { Markdown } from "../library/Markdown";
import { BookGirl, type BookGirlPose } from "./BookGirl";

/** How long she waits before settling down on her own. */
export const SETTLE_MS = 12_000;

const BTN =
  "inline-flex min-h-[var(--pw-targets-minimum)] items-center rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] px-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]";

function lower(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

export function LearnMoment({ moment }: { moment: LearningMoment }) {
  const book = worldsLibrary.books.find((b) => b.shelf === "words" && b.id === moment.concept);
  const title = book?.title ?? moment.concept.replace(/-/g, " ");
  const why = book?.pages.filter((p) => p.kind === "plain")[1]?.text ?? null;
  const [pose, setPose] = useState<BookGirlPose>("flying");
  const [open, setOpen] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const gotIt = useLearningGotIt();
  const herRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const offering = moment.stage === "first" || moment.stage === "again";

  // Ignored: she settles down on her own. Nothing is counted.
  useEffect(() => {
    if (!offering || open || pose !== "flying") return;
    const t = setTimeout(() => setPose("settled"), SETTLE_MS);
    return () => clearTimeout(t);
  }, [offering, open, pose]);

  if (!offering) return null;

  const lead =
    moment.stage === "again" && moment.first_context
      ? `You’ve seen this idea before. Remember ${moment.first_context}? Same idea: **${title}**.`
      : `There’s a name for part of what you just made. **${title}**: ${lower(book?.short ?? "")}`.replace(/: $/, ".");

  return (
    <div className="bookgirl-moment" data-stage={moment.stage}>
      <button
        ref={herRef}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? `Book Girl: ${title}` : "There’s a name for something you just made (optional)"}
        onClick={() => {
          setOpen(!open);
          setPose(open ? "settled" : "resting");
        }}
        className="bookgirl-button"
      >
        <BookGirl pose={pose} />
      </button>
      <div id={id} role="status" aria-live="polite">
        {open ? (
          <div className="bookgirl-card">
            <div className="lib-page flex flex-col gap-[var(--pw-spacing-sm)] text-[var(--pw-text-primary)]">
              <Markdown text={`📚 ${lead}`} />
              {showWhy && why ? (
                <div className="text-[var(--pw-text-secondary)]">
                  <Markdown text={why} />
                </div>
              ) : null}
            </div>
            <div className="mt-[var(--pw-spacing-sm)] flex flex-wrap gap-[var(--pw-spacing-sm)]">
              {why && !showWhy ? (
                <button type="button" className={BTN} onClick={() => setShowWhy(true)}>
                  Why designers use this
                </button>
              ) : null}
              <button
                type="button"
                className={BTN}
                onClick={() => {
                  gotIt.mutate(moment.concept);
                  setOpen(false);
                  setPose("settled");
                  setDone(`She’ll get quieter about ${lower(title)} from here.`);
                  herRef.current?.focus();
                }}
              >
                Got it
              </button>
            </div>
          </div>
        ) : done ? (
          <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">{done}</p>
        ) : null}
      </div>
    </div>
  );
}
