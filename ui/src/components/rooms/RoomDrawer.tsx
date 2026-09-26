/**
 * RoomDrawer — open a doorway to see the whole room (canvas board
 * Spec-Drawer, Doorways direction, 2026-09-25).
 *
 * A NON-modal side panel (portalled to <body>, above the app chrome): the
 * page behind stays usable, Escape closes it,
 * focus moves to its heading on open and back to the control that opened
 * it on close (the panel owns that). Everything it shows is what the room
 * reported through room/0, in words; Worlds adds nothing it can't verify.
 *
 *   - what needs you (unseen needs), each with the room's own link when
 *     the room sent a safe one, and "Mark as seen";
 *   - what changed since you last looked (cards observed after your last
 *     visit), then everything else the room is showing;
 *   - where this comes from, with the technical detail folded away.
 *
 * Card tone is a display hint only (room/0 1.1.0: good_news | update |
 * when_ready; anything else reads as update) and never an urgency. A card
 * past its freshness window says so. An unreachable or incompatible room
 * shows no cards as current.
 *
 * Opening the drawer is not a visit: the "changed" list stays put while
 * you read it. Opening the room itself is the visit.
 */
import { Icon } from "../Icon";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMarkNeedSeen } from "../../data/hooks";
import type { RoomActionReceipt, RoomCard, RoomKeeper, RoomNeed, RoomRow } from "../../data/contract";
import {
  approvalId,
  formatTime,
  LINK_BASE,
  plural,
  relativeTime,
  roomItemUrl,
  roomName,
  SECRETS_ROOM_ID,
  toneWord,
} from "./format";
import { currentNeeds, isUncertain, seenNeeds } from "./groupRooms";
import { Emblem, OpenLink, StatusWord } from "./parts";
import { SecretsSection } from "./SecretsSection";
import { ApprovalReview } from "./ApprovalReview";
import { useAskInChat } from "../../app/askInChat";
import { useMinuteClock } from "./useRootAttribute";

function isStale(card: RoomCard, now: number): boolean {
  const seen = card.freshness?.observed_at ? new Date(card.freshness.observed_at).getTime() : NaN;
  const window = card.freshness?.stale_after_s;
  if (Number.isNaN(seen) || typeof window !== "number" || now === 0) return false;
  return now - seen > window * 1000;
}

function changedSinceVisit(card: RoomCard, lastVisit: string | null | undefined): boolean {
  if (!lastVisit) return false;
  const visited = new Date(lastVisit).getTime();
  const seen = card.freshness?.observed_at ? new Date(card.freshness.observed_at).getTime() : NaN;
  return !Number.isNaN(visited) && !Number.isNaN(seen) && seen > visited;
}

const CHIP =
  "inline-block rounded-[var(--pw-radius-sm)] px-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_label)] font-bold uppercase tracking-[0.08em]";
const SECTION_TITLE =
  "mb-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.12em] text-[var(--pw-text-muted)]";
const SMALL = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const MICRO = "text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]";

function CardRow({ row, card, now }: { row: RoomRow; card: RoomCard; now: number }) {
  const href = roomItemUrl(row, card.link);
  const stale = isStale(card, now);
  return (
    <li className="flex flex-col gap-[var(--pw-spacing-xs)] border-t border-[var(--pw-border-subtle)] py-[var(--pw-spacing-md)]">
      <span>
        <span className={`${CHIP} border border-[var(--pw-accent-warm)] text-[var(--pw-text-primary)]`}>
          {toneWord(card.tone)}
        </span>
      </span>
      <span className="font-semibold text-[var(--pw-text-primary)]">{card.title}</span>
      {card.body && <span className={SMALL}>{card.body}</span>}
      <span className={MICRO}>
        {[
          card.freshness?.observed_at ? relativeTime(card.freshness.observed_at, now) : null,
          stale ? "may be out of date" : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
      {href && (
        <span>
          <OpenLink row={row} item={card} label={`Open “${card.title}”`} />
        </span>
      )}
    </li>
  );
}

interface Decided {
  need: RoomNeed;
  verb: "approve" | "decline";
  receipt: RoomActionReceipt;
}

/** Shown only from the room's receipt (ok: true), never on send. It
 *  takes focus, because the need it replaces has just gone. */
function DecidedNotice({ item, name }: { item: Decided; name: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <li className="flex flex-col gap-[var(--pw-spacing-xs)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-md)]">
      <p
        ref={ref}
        tabIndex={-1}
        role="status"
        className="text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]"
      >
        {item.verb === "approve" ? "Approved" : "Declined"}
      </p>
      <span className={SMALL}>{item.receipt.summary}</span>
      <span className={MICRO}>
        {item.receipt.at ? `${name} confirmed at ${formatTime(item.receipt.at)}.` : `${name} confirmed it.`}
      </span>
    </li>
  );
}

/** The question "Ask about … in Chat" writes for the person: the room,
 *  what changed since their last visit and what needs them, in words
 *  the chat can use. It is only ever a draft; the person sends it. */
function askQuestion(row: RoomRow, name: string, changed: RoomCard[], needs: RoomRow["needs_you"]): string {
  const since = row.last_visited_at ? ` since I last looked (${formatTime(row.last_visited_at)})` : "";
  const parts = [`What changed in ${name}${since}?`];
  if (changed.length > 0) parts.push(`${name} is showing: ${changed.map((c) => `“${c.title}”`).join(", ")}.`);
  if (needs.length > 0) parts.push(`It needs me for: ${needs.map((n) => `“${n.title}”`).join(", ")}.`);
  return parts.join(" ");
}

export function RoomDrawer({
  row,
  keeper,
  onClose,
}: {
  row: RoomRow;
  keeper: RoomKeeper | null;
  onClose: () => void;
}) {
  const name = roomName(row);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const markSeen = useMarkNeedSeen();
  const now = useMinuteClock();

  useEffect(() => {
    headingRef.current?.focus();
  }, [row.id]);

  const [decided, setDecided] = useState<Decided[]>([]);
  const uncertain = isUncertain(row);
  const needs = currentNeeds(row).filter((n) => !decided.some((d) => d.need.id === n.id));
  const seen = seenNeeds(row);
  const cards = uncertain ? [] : (row.cards ?? []);
  const changed = cards.filter((c) => changedSinceVisit(c, row.last_visited_at));
  const rest = cards.filter((c) => !changed.includes(c));
  const titleId = `room-drawer-${row.id}-title`;
  const ask = useAskInChat();

  // Portalled to <body>: the Bridge's main area is its own stacking
  // context, and the panel must sit above the app's top bar.
  return createPortal(
    <aside
      role="dialog"
      aria-labelledby={titleId}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[500px] flex-col gap-[var(--pw-spacing-lg)] overflow-y-auto border-l border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)] pt-[calc(var(--pw-spacing-lg)+var(--pw-safe-area-inset-top,0px))] shadow-[-10px_0_30px_rgba(8,10,24,0.45)] pb-[calc(var(--pw-spacing-lg)+var(--pw-safe-area-inset-bottom,0px))]"
    >
      <header className="flex items-center gap-[var(--pw-spacing-md)]">
        <Emblem row={row} keeper={keeper} size="sm" />
        <div className="min-w-0 flex-1">
          <h2
            id={titleId}
            ref={headingRef}
            tabIndex={-1}
            className="text-[length:var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-primary)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]"
            style={{ fontFamily: "var(--pw-typography-font_serif, inherit)" }}
          >
            {name}
          </h2>
          <p className={`${MICRO} flex flex-wrap gap-x-[var(--pw-spacing-xs)]`}>
            {keeper && <span>{`with ${keeper.name} ·`}</span>}
            <StatusWord row={row} />
            <span>{`· checked ${relativeTime(row.checked_at, now)}`}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${name} details`}
          className={`${LINK_BASE} border border-[var(--pw-border-subtle)] bg-transparent px-0 text-[var(--pw-text-secondary)]`}
        >
          <Icon name="close" size={20} />
        </button>
      </header>

      {uncertain && (
        <p className="rounded-[var(--pw-radius-sm)] border border-dashed border-[var(--pw-text-muted)] p-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          {row.status === "incompatible"
            ? `${name} speaks a room contract this front door doesn’t support${
                row.error ? ` (${row.error})` : ""
              }, so nothing it reports is shown as current.`
            : !row.reachable
              ? `Worlds can’t reach ${name} right now${
                  row.last_seen ? `; it last answered ${formatTime(row.last_seen)}` : ""
                }. Nothing here is current.`
              : `${name} is answering but hasn’t reported a status, so Worlds won’t guess.`}
        </p>
      )}

      {decided.length > 0 && (
        <section aria-labelledby={`${titleId}-decided`}>
          <h3 id={`${titleId}-decided`} className={SECTION_TITLE}>
            Decided just now
          </h3>
          <ul className="flex flex-col gap-[var(--pw-spacing-md)]">
            {decided.map((d) => (
              <DecidedNotice key={d.need.id} item={d} name={name} />
            ))}
          </ul>
        </section>
      )}

      {needs.length > 0 && (
        <section aria-labelledby={`${titleId}-needs`}>
          <h3 id={`${titleId}-needs`} className={SECTION_TITLE}>
            {`Needs you · ${needs.length}`}
          </h3>
          <ul className="flex flex-col gap-[var(--pw-spacing-md)]">
            {needs.map((need) => {
              const href = roomItemUrl(row, need.link);
              const approval = uncertain ? null : approvalId(need);
              return (
                <li
                  key={need.id}
                  className="flex flex-col gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-md)] border border-[var(--pw-accent-warm)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-md)]"
                >
                  <span>
                    <span className={`${CHIP} border border-[var(--pw-accent-warm)] bg-[var(--pw-accent-warm_soft)] text-[var(--pw-text-primary)]`}>
                      Needs you
                    </span>
                  </span>
                  <span className="text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)]">
                    {need.title}
                  </span>
                  {need.why && <span className={SMALL}>{need.why}</span>}
                  <span className={MICRO}>{`Waiting since ${formatTime(need.created_at)}`}</span>
                  <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
                    {href && <OpenLink row={row} item={need} label={`Review “${need.title}”`} />}
                    <button
                      type="button"
                      disabled={markSeen.isPending}
                      onClick={() => markSeen.mutate({ roomId: row.id, needId: need.id })}
                      aria-label={`Mark “${need.title}” as seen`}
                      className={`${LINK_BASE} border border-[var(--pw-border-subtle)] bg-transparent text-[var(--pw-text-primary)] disabled:opacity-60`}
                    >
                      Mark as seen
                    </button>
                    {approval && (
                      <ApprovalReview
                        roomId={row.id}
                        roomName={name}
                        need={need}
                        approval={approval}
                        onDecided={(verb, receipt) =>
                          setDecided((all) => [...all, { need, verb, receipt }])
                        }
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {markSeen.isError && (
            <p role="alert" className={`${SMALL} mt-[var(--pw-spacing-sm)]`}>
              Couldn’t mark that as seen. It’s still waiting.
            </p>
          )}
        </section>
      )}
      {seen.length > 0 && (
        <p className={SMALL}>
          {`${plural(seen.length, "need", "needs")} you’ve already seen ${
            seen.length === 1 ? "is" : "are"
          } still open in ${name}.`}
        </p>
      )}

      {changed.length > 0 && (
        <section aria-labelledby={`${titleId}-changed`}>
          <h3 id={`${titleId}-changed`} className={SECTION_TITLE}>
            {`Changed since you last looked · ${changed.length}`}
          </h3>
          <ul>
            {changed.map((card) => (
              <CardRow key={card.id} row={row} card={card} now={now} />
            ))}
          </ul>
        </section>
      )}

      {!uncertain && (
        <section aria-labelledby={`${titleId}-cards`}>
          <h3 id={`${titleId}-cards`} className={SECTION_TITLE}>
            {changed.length > 0 ? `Everything else · ${rest.length}` : `What ${name} is showing · ${rest.length}`}
          </h3>
          {rest.length === 0 ? (
            <p className={SMALL}>
              {changed.length > 0 ? "Nothing else right now." : `${name} has nothing to show right now.`}
            </p>
          ) : (
            <ul>
              {rest.map((card) => (
                <CardRow key={card.id} row={row} card={card} now={now} />
              ))}
            </ul>
          )}
        </section>
      )}

      {row.id === SECRETS_ROOM_ID && <SecretsSection headingId={`${titleId}-secrets`} />}

      <section aria-labelledby={`${titleId}-source`} className="flex flex-col gap-[var(--pw-spacing-xs)]">
        <h3 id={`${titleId}-source`} className={SECTION_TITLE}>
          Where this comes from
        </h3>
        <p className={SMALL}>
          {row.room?.updated_at
            ? `Reported by ${name} itself (room/0), ${formatTime(row.room.updated_at)}. Worlds shows it as-is and doesn’t guess.`
            : `Worlds hasn’t had a report from ${name} yet, so it shows nothing it can’t verify.`}
        </p>
        <details className={SMALL}>
          <summary className="flex min-h-[var(--pw-targets-minimum)] cursor-pointer items-center">
            Technical detail
          </summary>
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-[var(--pw-spacing-md)] gap-y-[var(--pw-spacing-xs)] pb-[var(--pw-spacing-sm)]">
            <dt>Contract</dt>
            <dd className="break-words">{row.room?.contract ?? "not reported"}</dd>
            <dt>Version</dt>
            <dd className="break-words">{row.room?.version ?? "not reported"}</dd>
            <dt>Commit</dt>
            <dd className="break-words">{row.room?.commit ?? "not reported"}</dd>
            <dt>Address</dt>
            <dd className="break-all">{row.base_url}</dd>
            {row.public_url && row.public_url !== row.base_url && (
              <>
                <dt>Opens at</dt>
                <dd className="break-all">{row.public_url}</dd>
              </>
            )}
            <dt>Last checked</dt>
            <dd>{formatTime(row.checked_at)}</dd>
            {row.error && (
              <>
                <dt>Problem</dt>
                <dd className="break-words">{row.error}</dd>
              </>
            )}
          </dl>
        </details>
      </section>

      <footer className="mt-auto flex flex-wrap gap-[var(--pw-spacing-sm)] border-t border-[var(--pw-border-subtle)] pt-[var(--pw-spacing-md)]">
        <OpenLink row={row} primary />
        {ask && (
          <button
            type="button"
            onClick={() => {
              ask(askQuestion(row, name, changed, needs));
              onClose();
            }}
            className={`${LINK_BASE} border border-[var(--pw-border-subtle)] bg-transparent text-[var(--pw-text-primary)]`}
          >
            {`Ask about ${name} in Chat`}
          </button>
        )}
      </footer>
    </aside>,
    document.body,
  );
}
