/**
 * Follow something you're curious about, right here (owner's first-day
 * walk-through, 2026-09-27: with nothing followed, the page had nowhere to
 * go). One box, then it says so in words (POST /api/discovery/interests is a
 * signed-in person's own write and needs no step-up; if the server ever
 * asks for one, the confirm prompt below still handles it).
 */
import { useId, useState } from "react";
import { addDiscoveryInterest } from "../../data/api";
import { describeError } from "../../data/errors";
import { ConfirmItsYou } from "../../components/ConfirmItsYou";
import { useConfirmed } from "../../components/useConfirmed";
import { WorldButton } from "../../components/WorldButton";

export function AddInterest({ onAdded }: { onAdded?: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; words: string } | null>(null);
  const confirm = useConfirmed();
  const id = useId();

  function add() {
    const words = name.trim();
    if (!words) return;
    setSaid(null);
    confirm.run((onError) => {
      setBusy(true);
      addDiscoveryInterest(words)
        .then(() => {
          setName("");
          setSaid({ ok: true, words: `Following “${words}”. The next check looks for it.` });
          onAdded?.();
        })
        .catch((e: unknown) => {
          if (!onError(e)) setSaid({ ok: false, words: describeError(e, "Couldn’t add that just now; nothing changed.") });
        })
        .finally(() => setBusy(false));
    });
  }

  return (
    <div className="flex flex-col gap-[var(--pw-spacing-sm)]">
      <form
        className="flex flex-wrap items-end gap-[var(--pw-spacing-sm)]"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label htmlFor={`${id}-n`} className="flex min-w-0 flex-1 basis-[14rem] flex-col gap-[var(--pw-spacing-xs)]">
          <span className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-primary)]">What are you curious about?</span>
          <input
            id={`${id}-n`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="like “moon gardening” or “kilns”"
            className="min-h-[var(--pw-targets-minimum)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] px-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]"
          />
        </label>
        <WorldButton type="submit" variant="primary" isDisabled={!name.trim() || busy}>
          {busy ? "Adding…" : "Follow it"}
        </WorldButton>
      </form>
      <p role="status" className={`min-h-[1.5em] text-[length:var(--pw-typography-size_small)] ${said?.ok === false ? "text-[var(--pw-accent-warm)]" : "text-[var(--pw-text-primary)]"}`}>
        {said?.words}
      </p>
      {confirm.confirming && (
        <ConfirmItsYou
          intro="Following something changes what Worlds looks for. Confirm it's you first."
          onConfirmed={confirm.confirmed}
          onCancel={confirm.cancel}
        />
      )}
    </div>
  );
}
