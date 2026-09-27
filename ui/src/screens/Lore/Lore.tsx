/**
 * Your lore (owner ask, 2026-09-27): what Worlds knows about you, from your
 * lore files, in one calm place. Grouped by title and section. Suggestions
 * are clearly "waiting for you" and each can be confirmed with one tap;
 * confirmed means "Worlds treats this as true". Only the owner confirms,
 * behind "Confirm it's you" (one confirmation covers a few minutes of taps).
 * Items no longer in the lore files are shown quietly at the end, never
 * deleted. Checking for changes and bringing them in stay at the top.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLore, useLoreConfirm } from "../../data/hooks";
import type { LoreItem } from "../../data/api";
import { describeError } from "../../data/errors";
import { ConfirmItsYou } from "../../components/ConfirmItsYou";
import { useConfirmed } from "../../components/useConfirmed";
import { SolMoment } from "../../components/SolMoment";
import { Icon } from "../../components/Icon";
import { WorldButton } from "../../components/WorldButton";
import { LoreSection } from "../Settings/LoreSection";

const SERIF = { fontFamily: "var(--pw-typography-font_serif, inherit)" } as const;
const SMALL = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const EYEBROW =
  "text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.12em] text-[var(--pw-accent-warm)]";
const CHIP_ON =
  "inline-flex min-h-[var(--pw-targets-minimum)] items-center rounded-full border border-[var(--pw-accent-warm)] bg-[var(--pw-accent-warm_soft)] px-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-text-primary)]";
const CHIP_OFF =
  "inline-flex min-h-[var(--pw-targets-minimum)] items-center rounded-full border border-[var(--pw-border-subtle)] px-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";

type Show = "waiting" | "confirmed" | "all";

const isWaiting = (i: LoreItem) => i.state === "suggested" && !i.gone;
const isConfirmed = (i: LoreItem) => i.state === "confirmed" && !i.gone;

/** What the lore files themselves say about an item, in plain words. */
function sourceWords(i: LoreItem): string | null {
  if (i.status === "accepted") return "Marked accepted in your files";
  if (i.status === "candidate") return "A candidate in your files";
  if (i.status === "note") return "A note in your files";
  return null;
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Title → section → items, in the order the lore gives them. */
function group(items: LoreItem[]) {
  const titles = new Map<string, Map<string, LoreItem[]>>();
  for (const it of items) {
    const title = it.title?.trim() || "Other";
    const section = it.section?.trim() || "";
    if (!titles.has(title)) titles.set(title, new Map());
    const sections = titles.get(title)!;
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section)!.push(it);
  }
  return titles;
}

function Item({
  item,
  busy,
  onConfirm,
}: {
  item: LoreItem;
  busy: boolean;
  onConfirm?: () => void;
}) {
  const waiting = isWaiting(item);
  const confirmed = isConfirmed(item);
  const from = sourceWords(item);
  return (
    <li
      className={`flex flex-col gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-md)] border p-[var(--pw-spacing-md)] ${
        waiting
          ? "border-[var(--pw-accent-warm)] bg-[var(--pw-surface-panel)]"
          : item.gone
            ? "border-dashed border-[var(--pw-border-subtle)] opacity-70"
            : "border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)]"
      }`}
    >
      <p className="whitespace-pre-wrap break-words text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)]">{item.text}</p>
      <p className={`${SMALL} flex flex-wrap items-center gap-x-[var(--pw-spacing-sm)] gap-y-[var(--pw-spacing-xs)]`}>
        {waiting ? (
          <span className="inline-flex items-center gap-[var(--pw-spacing-xs)] font-semibold text-[var(--pw-accent-warm)]">
            <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-[var(--pw-accent-warm)]" />
            Waiting for you
          </span>
        ) : confirmed ? (
          <span className="inline-flex items-center gap-[var(--pw-spacing-xs)] font-semibold text-[var(--pw-text-primary)]">
            <Icon name="check" size={16} />
            Confirmed
          </span>
        ) : item.gone ? (
          <span>No longer in your lore files</span>
        ) : (
          <span>{item.state === "derived" ? "Worked out from other things" : "Just for now"}</span>
        )}
        {from ? <span>{`· ${from}`}</span> : null}
        {item.kind === "profile" ? <span>· Profile</span> : null}
      </p>
      {waiting && onConfirm ? (
        <span>
          <WorldButton variant="secondary" isDisabled={busy} onPress={onConfirm} aria-label={`Confirm: ${item.text.slice(0, 80)}`}>
            <Icon name="check" size={16} className="mr-[var(--pw-spacing-xs)]" />
            Confirm
          </WorldButton>
        </span>
      ) : null}
    </li>
  );
}

export function Lore({ onBack, backLabel = "Back to Memory" }: { onBack: () => void; backLabel?: string }) {
  const lore = useLore();
  const confirmLore = useLoreConfirm();
  const confirm = useConfirmed();
  const [said, setSaid] = useState<string | null>(null);
  const [find, setFind] = useState("");
  const items = useMemo(() => lore.data?.data?.items ?? [], [lore.data]);
  const waiting = items.filter(isWaiting).length;
  const confirmedCount = items.filter(isConfirmed).length;
  const gone = items.filter((i) => i.gone);
  const [show, setShow] = useState<Show | null>(null);
  // Start on what's waiting when there is any, otherwise everything, and
  // stay there: confirming the last one shouldn't jump the view.
  const loaded = lore.isSuccess;
  if (show === null && loaded) setShow(waiting > 0 ? "waiting" : "all");
  const current: Show = show ?? (waiting > 0 ? "waiting" : "all");
  const id = useId();
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (said) statusRef.current?.focus();
  }, [said]);

  const words = find.trim().toLowerCase();
  const shown = items.filter(
    (i) =>
      !i.gone &&
      (current === "all" || (current === "waiting" ? isWaiting(i) : isConfirmed(i))) &&
      (!words || `${i.text} ${i.title ?? ""} ${i.section ?? ""}`.toLowerCase().includes(words)),
  );
  const groups = group(shown);

  function confirmKeys(keys: string[], what: string) {
    setSaid(null);
    confirm.run((onError) =>
      confirmLore.mutate(
        { keys },
        {
          onSuccess: (r) => {
            const n = r.data?.confirmed ?? keys.length;
            setSaid(n === 1 ? `Confirmed: ${what}` : `Confirmed ${plural(n, "thing")} in ${what}.`);
          },
          onError: (e) => {
            if (!onError(e)) setSaid(describeError(e, "Couldn’t confirm that; nothing changed."));
          },
        },
      ),
    );
  }

  return (
    <main id="main-content" aria-label="Your lore" className="relative z-10 mx-auto max-w-3xl p-[var(--pw-spacing-xl)] md:p-[var(--pw-spacing-3xl)]">
      <WorldButton variant="ghost" onPress={onBack} className="mb-[var(--pw-spacing-md)]">
        <Icon name="back" size={16} className="mr-[var(--pw-spacing-xs)]" />
        {backLabel}
      </WorldButton>
      <header className="mb-[var(--pw-spacing-xl)] flex flex-wrap items-center gap-[var(--pw-spacing-lg)]">
        <SolMoment mood="reading" size={80} />
        <div className="min-w-[14rem] flex-1">
          <h1 className="text-[length:var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]" style={SERIF}>
            Your lore
          </h1>
          <p className="text-[var(--pw-text-secondary)]">
            What Worlds knows about you, from your lore files. New things wait for you; only you confirm them, and
            confirmed means Worlds treats it as true.
          </p>
        </div>
      </header>

      <section aria-labelledby={`${id}-sync`} className="mb-[var(--pw-spacing-xl)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-lg)]">
        <h2 id={`${id}-sync`} className={`${EYEBROW} mb-[var(--pw-spacing-sm)]`}>
          Keep it up to date
        </h2>
        <LoreSection />
      </section>

      <p
        ref={statusRef}
        tabIndex={-1}
        role="status"
        className="mb-[var(--pw-spacing-md)] min-h-[1.5em] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)] focus:outline-none"
      >
        {said}
      </p>
      {confirm.confirming && (
        <div className="mb-[var(--pw-spacing-lg)]">
          <ConfirmItsYou
            intro="Confirming makes it what Worlds treats as true about you. Confirm it's you first; it covers the next few minutes of taps."
            onConfirmed={confirm.confirmed}
            onCancel={confirm.cancel}
          />
        </div>
      )}

      {lore.isPending ? (
        <p className={SMALL}>Reading your lore…</p>
      ) : lore.isError ? (
        <p className={SMALL}>Couldn’t read your lore just now. Nothing was changed.</p>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-[var(--pw-spacing-md)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] p-[var(--pw-spacing-lg)]">
          <SolMoment mood="curious" size={56} />
          <p className="text-[var(--pw-text-secondary)]">No lore here yet. “Check for changes” above looks at your lore files and says what it would bring in.</p>
        </div>
      ) : (
        <>
          <div className="mb-[var(--pw-spacing-lg)] flex flex-col gap-[var(--pw-spacing-md)]">
            <div role="group" aria-label="Show" className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
              {(
                [
                  ["waiting", `Waiting for you · ${waiting}`],
                  ["confirmed", `Confirmed · ${confirmedCount}`],
                  ["all", `All · ${items.length - gone.length}`],
                ] as [Show, string][]
              ).map(([k, label]) => (
                <button key={k} type="button" aria-pressed={current === k} onClick={() => setShow(k)} className={current === k ? CHIP_ON : CHIP_OFF}>
                  {label}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-[var(--pw-spacing-xs)]">
              <span className={SMALL}>Find in your lore</span>
              <input
                type="search"
                value={find}
                onChange={(e) => setFind(e.target.value)}
                className="min-h-[var(--pw-targets-minimum)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] px-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]"
              />
            </label>
          </div>

          {shown.length === 0 ? (
            current === "waiting" && !words ? (
              <div className="flex items-center gap-[var(--pw-spacing-md)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] p-[var(--pw-spacing-lg)]">
                <SolMoment mood="proud" size={56} />
                <p className="text-[var(--pw-text-primary)]">Nothing is waiting for you. Everything here is confirmed or kept as it is.</p>
              </div>
            ) : (
              <p className={SMALL}>Nothing matches that.</p>
            )
          ) : (
            <div className="flex flex-col gap-[var(--pw-spacing-2xl)]">
              {[...groups.entries()].map(([title, sections]) => {
                const inTitle = [...sections.values()].flat();
                const waitingHere = inTitle.filter(isWaiting);
                return (
                  <section key={title} aria-label={title} className="flex flex-col gap-[var(--pw-spacing-md)]">
                    <div className="flex flex-wrap items-baseline gap-x-[var(--pw-spacing-md)] gap-y-[var(--pw-spacing-xs)]">
                      <h2 className="text-[length:var(--pw-typography-size_h2,var(--pw-typography-size_lead))] font-semibold text-[var(--pw-text-primary)]" style={SERIF}>
                        {title}
                      </h2>
                      <span className={SMALL}>
                        {[plural(inTitle.length, "thing"), waitingHere.length ? `${waitingHere.length} waiting for you` : null].filter(Boolean).join(" · ")}
                      </span>
                      {waitingHere.length > 1 ? (
                        <WorldButton
                          variant="ghost"
                          isDisabled={confirmLore.isPending}
                          onPress={() => confirmKeys(waitingHere.map((i) => i.key), title)}
                        >
                          {`Confirm all ${waitingHere.length} in ${title}`}
                        </WorldButton>
                      ) : null}
                    </div>
                    {[...sections.entries()].map(([section, list]) => (
                      <div key={section || "_"} className="flex flex-col gap-[var(--pw-spacing-sm)]">
                        {section ? <h3 className={EYEBROW}>{section}</h3> : null}
                        <ul className="flex flex-col gap-[var(--pw-spacing-sm)]">
                          {list.map((it) => (
                            <Item
                              key={it.key}
                              item={it}
                              busy={confirmLore.isPending}
                              onConfirm={() => confirmKeys([it.key], it.text.length > 80 ? `${it.text.slice(0, 80)}…` : it.text)}
                            />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </section>
                );
              })}
            </div>
          )}

          {gone.length > 0 && (
            <details className="mt-[var(--pw-spacing-2xl)] rounded-[var(--pw-radius-md)] border border-dashed border-[var(--pw-border-subtle)] p-[var(--pw-spacing-md)]">
              <summary className="flex min-h-[var(--pw-targets-minimum)] cursor-pointer items-center gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] text-[var(--pw-text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]">
                {`No longer in your lore files · ${gone.length}`}
                <span className={SMALL}>Kept here, not deleted.</span>
              </summary>
              <ul className="mt-[var(--pw-spacing-sm)] flex flex-col gap-[var(--pw-spacing-sm)]">
                {gone.map((it) => (
                  <Item key={it.key} item={it} busy />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </main>
  );
}
