/**
 * The Later shelf: ideas kept safe, with at most three in progress at
 * once (owner ask, 2026-09-27). Starting a fourth kindly offers a swap
 * instead of refusing, done things are celebrated quietly, and nothing
 * is ever dropped: "Set back" returns an idea to the shelf.
 */
import { useId, useState } from "react";
import { useLater, useMoveLater } from "../../data/hooks";
import type { LaterItem } from "../../data/api";
import { relativeTime } from "../../components/rooms/format";
import { useMinuteClock } from "../../components/rooms/useRootAttribute";
import { WorldButton } from "../../components/WorldButton";
import { SolMoment } from "../../components/SolMoment";
import { Icon } from "../../components/Icon";

const SERIF = { fontFamily: "var(--pw-typography-font_serif, inherit)" } as const;
const SMALL = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const EYEBROW =
  "text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.12em] text-[var(--pw-accent-warm)]";

function fromWords(source: string): string | null {
  if (!source || source === "worlds") return null;
  if (source === "share") return "From the Share sheet";
  if (source === "agent") return "From a helper";
  return `From ${source}`;
}

function Idea({ item, now, children }: { item: LaterItem; now: number; children?: React.ReactNode }) {
  const from = fromWords(item.source);
  return (
    <li className="flex flex-col gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-md)]">
      <p className="whitespace-pre-wrap break-words text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)]">{item.text}</p>
      <p className={SMALL}>{[from, `kept ${relativeTime(item.created, now)}`].filter(Boolean).join(" · ")}</p>
      {children ? <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">{children}</div> : null}
    </li>
  );
}

export function LaterShelf() {
  const shelf = useLater();
  const move = useMoveLater();
  const now = useMinuteClock();
  const [said, setSaid] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<LaterItem | null>(null);
  const id = useId();
  const data = shelf.data?.data;
  const max = data?.max_in_progress ?? 3;
  const doing = data?.in_progress ?? [];
  const later = data?.later ?? [];
  const done = data?.done ?? [];

  function go(item: LaterItem, to: "doing" | "done" | "later", after?: () => void) {
    setSaid(null);
    move.mutate(
      { id: item.id, to },
      {
        onSuccess: (res) => {
          setSaid(res.data?.said ?? null);
          after?.();
        },
        onError: (err) => setSaid(err instanceof Error ? err.message : "Couldn’t move that just now. Nothing was lost."),
      },
    );
  }

  function start(item: LaterItem) {
    if (doing.length >= max) {
      setSaid(null);
      setSwapFor(item);
      return;
    }
    go(item, "doing");
  }

  return (
    <section aria-labelledby={`${id}-h`} className="flex flex-col gap-[var(--pw-spacing-lg)]">
      <div>
        <h2 id={`${id}-h`} className="text-[length:var(--pw-typography-size_h2,var(--pw-typography-size_lead))] font-semibold text-[var(--pw-text-primary)]" style={SERIF}>
          Later shelf
        </h2>
        <p className={SMALL}>Ideas kept safe until you want them. Up to three can be in progress at once; nothing here is ever dropped.</p>
      </div>

      <p role="status" className="min-h-[1.5em] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)]">
        {said}
      </p>

      {shelf.isPending ? (
        <p className={SMALL}>Finding your shelf…</p>
      ) : shelf.isError ? (
        <p className={SMALL}>Couldn’t open the Later shelf just now. Everything on it is still kept.</p>
      ) : (
        <>
          {swapFor && (
            <div
              role="group"
              aria-labelledby={`${id}-swap`}
              className="flex flex-col gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-md)] border border-[var(--pw-accent-warm)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-md)]"
            >
              <p id={`${id}-swap`} className="text-[var(--pw-text-primary)]">
                {`Three things are already in progress. Set one back to start “${swapFor.text.slice(0, 60)}”?`}
              </p>
              <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
                {doing.map((d) => (
                  <WorldButton
                    key={d.id}
                    variant="secondary"
                    isDisabled={move.isPending}
                    onPress={() =>
                      go(d, "later", () => {
                        const next = swapFor;
                        setSwapFor(null);
                        go(next, "doing");
                      })
                    }
                  >
                    {`Set back “${d.text.slice(0, 40)}”`}
                  </WorldButton>
                ))}
                <WorldButton variant="ghost" onPress={() => setSwapFor(null)}>
                  Keep it on Later
                </WorldButton>
              </div>
            </div>
          )}

          <section aria-labelledby={`${id}-doing`} className="flex flex-col gap-[var(--pw-spacing-sm)]">
            <h3 id={`${id}-doing`} className={EYEBROW}>{`In progress (${doing.length} of ${max})`}</h3>
            {doing.length === 0 ? (
              <p className={SMALL}>Nothing in progress. Start something from the shelf when you feel like it.</p>
            ) : (
              <ul className="flex flex-col gap-[var(--pw-spacing-sm)]">
                {doing.map((item) => (
                  <Idea key={item.id} item={item} now={now}>
                    <WorldButton variant="primary" isDisabled={move.isPending} onPress={() => go(item, "done")}>
                      <Icon name="check" size={16} className="mr-[var(--pw-spacing-xs)]" />
                      Done
                    </WorldButton>
                    <WorldButton variant="ghost" isDisabled={move.isPending} onPress={() => go(item, "later")}>
                      Set back
                    </WorldButton>
                  </Idea>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby={`${id}-later`} className="flex flex-col gap-[var(--pw-spacing-sm)]">
            <h3 id={`${id}-later`} className={EYEBROW}>{`On the shelf · ${later.length}`}</h3>
            {later.length === 0 ? (
              <p className={SMALL}>The shelf is empty. When something can wait, press Remember and choose “Put it on Later”.</p>
            ) : (
              <ul className="flex flex-col gap-[var(--pw-spacing-sm)]">
                {[...later].reverse().map((item) => (
                  <Idea key={item.id} item={item} now={now}>
                    <WorldButton variant="secondary" isDisabled={move.isPending} onPress={() => start(item)}>
                      Start this
                    </WorldButton>
                  </Idea>
                ))}
              </ul>
            )}
          </section>

          {done.length > 0 && (
            <details className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] p-[var(--pw-spacing-md)]">
              <summary className="flex min-h-[var(--pw-targets-minimum)] cursor-pointer items-center gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]">
                <SolMoment mood="proud" size={40} />
                <span className="font-semibold text-[var(--pw-text-primary)]">{`Done · ${done.length}`}</span>
                <span className={SMALL}>Look at all that.</span>
              </summary>
              <ul className="mt-[var(--pw-spacing-sm)] flex flex-col gap-[var(--pw-spacing-xs)]">
                {[...done].reverse().map((item) => (
                  <li key={item.id} className="flex items-start gap-[var(--pw-spacing-sm)] py-[var(--pw-spacing-xs)] text-[var(--pw-text-secondary)]">
                    <Icon name="check" size={16} className="mt-[4px] shrink-0 text-[var(--pw-accent-warm)]" />
                    <span className="min-w-0 break-words">
                      {item.text}
                      <span className={`${SMALL} block`}>{`Done ${relativeTime(item.done_at ?? item.created, now)}`}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
