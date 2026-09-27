/**
 * Remember (owner ask, 2026-09-27, high priority): put a thought down and
 * trust it will be there. One box, typing or dictation, two choices:
 * keep it (your journal) or put it on the Later shelf. Nothing else is
 * required, and the answer is one plain word: "Kept."
 *
 * If keeping fails, the words stay in the box so nothing is lost.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useRemember } from "../../data/hooks";
import { WorldButton } from "../WorldButton";
import { SolMoment } from "../SolMoment";

export function RememberForm({
  initialText = "",
  source,
  autoFocus = true,
}: {
  initialText?: string;
  /** Where the words came from, e.g. "share" for the iPhone Share sheet. */
  source?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(initialText);
  const [said, setSaid] = useState<{ ok: boolean; words: string } | null>(null);
  const keep = useRemember();
  const id = useId();
  const empty = text.trim().length === 0;
  const boxRef = useRef<HTMLTextAreaElement>(null);
  // Start in the box. The drawer opens after this mounts, so wait a frame.
  useEffect(() => {
    if (!autoFocus) return;
    const f = requestAnimationFrame(() => boxRef.current?.focus());
    return () => cancelAnimationFrame(f);
  }, [autoFocus]);

  function send(later: boolean) {
    if (empty || keep.isPending) return;
    setSaid(null);
    keep.mutate(
      { text: text.trim(), ...(later ? { later: true } : {}), ...(source ? { source } : {}) },
      {
        onSuccess: (res) => {
          setText("");
          setSaid({
            ok: true,
            words: res.data?.kept === "later" ? "Kept. It’s on your Later shelf." : "Kept. It’s in your journal.",
          });
        },
        onError: () =>
          setSaid({ ok: false, words: "Couldn’t keep that just now. Your words are still here, so you can try again." }),
      },
    );
  }

  return (
    <form
      className="flex flex-col gap-[var(--pw-spacing-md)]"
      onSubmit={(e) => {
        e.preventDefault();
        send(false);
      }}
    >
      <label htmlFor={`${id}-t`} className="text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)]">
        What do you want to keep?
      </label>
      <textarea
        id={`${id}-t`}
        aria-describedby={`${id}-h`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (said?.ok) setSaid(null);
        }}
        ref={boxRef}
        rows={5}
        maxLength={2000}
        className="w-full resize-y rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_body)] leading-relaxed text-[var(--pw-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]"
      />
      <p id={`${id}-h`} className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
        Type it, or tap the microphone on your keyboard and say it.
      </p>
      <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
        <WorldButton type="submit" variant="primary" isDisabled={empty || keep.isPending}>
          Keep it
        </WorldButton>
        <WorldButton variant="secondary" isDisabled={empty || keep.isPending} onPress={() => send(true)}>
          Put it on Later
        </WorldButton>
      </div>
      <p role="status" className="flex min-h-[1.5em] items-center gap-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)]">
        {keep.isPending ? "Keeping…" : null}
        {said ? (
          <>
            {said.ok ? <SolMoment mood="proud" size={40} /> : null}
            <span className={said.ok ? "" : "text-[var(--pw-accent-warm)]"}>{said.words}</span>
          </>
        ) : null}
      </p>
    </form>
  );
}
