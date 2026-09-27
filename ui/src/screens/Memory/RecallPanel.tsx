/**
 * Recall: "What did I say about…" as a calm search (owner ask,
 * 2026-09-27). A plain word search over the person's journal, lore,
 * Later shelf and words they've found (no model needed). Every answer
 * says where it lives.
 */
import { reportSticker } from "../../components/stickers/report";
import { useEffect, useId, useState } from "react";
import { useRecall } from "../../data/hooks";
import { relativeTime } from "../../components/rooms/format";
import { useMinuteClock } from "../../components/rooms/useRootAttribute";
import { WorldButton } from "../../components/WorldButton";

const SERIF = { fontFamily: "var(--pw-typography-font_serif, inherit)" } as const;
const SMALL = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";

export function RecallPanel() {
  const [draft, setDraft] = useState("");
  const [asked, setAsked] = useState("");
  const found = useRecall(asked);
  const now = useMinuteClock();
  const id = useId();
  const results = found.data?.data?.results ?? [];
  useEffect(() => {
    if (results.length > 0) void reportSticker("found-it");
  }, [results.length]);

  return (
    <section aria-labelledby={`${id}-h`} className="flex flex-col gap-[var(--pw-spacing-md)]">
      <h2 id={`${id}-h`} className="text-[length:var(--pw-typography-size_h2,var(--pw-typography-size_lead))] font-semibold text-[var(--pw-text-primary)]" style={SERIF}>
        What did I say about…
      </h2>
      <form
        role="search"
        aria-label="Search what you've kept"
        className="flex flex-wrap gap-[var(--pw-spacing-sm)]"
        onSubmit={(e) => {
          e.preventDefault();
          setAsked(draft.trim());
        }}
      >
        <label htmlFor={`${id}-q`} className="sr-only">
          What did I say about…
        </label>
        <input
          id={`${id}-q`}
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="a word or two, like “lantern door”"
          className="min-h-[var(--pw-targets-minimum)] min-w-0 flex-1 basis-[14rem] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] px-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]"
        />
        <WorldButton type="submit" variant="primary" isDisabled={draft.trim().length === 0}>
          Find it
        </WorldButton>
      </form>

      <div role="status" aria-live="polite" className="flex flex-col gap-[var(--pw-spacing-sm)]">
        {!asked ? null : found.isPending ? (
          <p className={SMALL}>Looking…</p>
        ) : found.isError ? (
          <p className={SMALL}>Couldn’t search just now. Everything you’ve kept is still there.</p>
        ) : results.length === 0 ? (
          <p className={SMALL}>{`Nothing found for “${asked}”. Try fewer words, or different ones.`}</p>
        ) : (
          <p className={SMALL}>{`${results.length} ${results.length === 1 ? "thing" : "things"} found for “${asked}”.`}</p>
        )}
      </div>
      {asked && results.length > 0 && (
        <ul className="flex flex-col gap-[var(--pw-spacing-sm)]">
          {results.map((r, i) => (
            <li key={`${r.kind}-${i}`} className="flex flex-col gap-[var(--pw-spacing-xs)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-md)]">
              {r.title ? <p className="font-semibold text-[var(--pw-text-primary)]">{r.title}</p> : null}
              <p className="whitespace-pre-wrap break-words text-[var(--pw-text-primary)]">{r.text}</p>
              <p className={SMALL}>
                <span className="font-semibold text-[var(--pw-accent-warm)]">{r.where}</span>
                {r.when ? ` · ${relativeTime(r.when, now)}` : ""}
                {r.kind === "lore" && r.state === "suggested" ? " · waiting for you" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
