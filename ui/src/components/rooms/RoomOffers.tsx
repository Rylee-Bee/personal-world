/**
 * "Ask {room} to…": the room's own actions that aren't tied to one need
 * (for example Hive Works' "Re-check the tickets"). They come from the
 * row's `actions` list (the room's GET /room/actions, passed through by
 * GET /api/rooms). Actions that answer a need (approve, decline,
 * answer-decision) are offered on the need itself, not here.
 *
 * A write (`writes` true or missing: fail closed) is only offered to
 * someone who may approve; a read-only action is offered to everyone.
 * A press sends the action with a fresh Idempotency-Key, says
 * "Asking…" (static), then shows the room's receipt in its own words.
 */
import { useEffect, useRef, useState } from "react";
import { useRoomAction } from "../../data/hooks";
import type { RoomActionReceipt, RoomOffer, RoomRow } from "../../data/contract";
import { formatTime, idempotencyKey, LINK_BASE } from "./format";
import { offerLabel } from "./choices";

const SECTION_TITLE =
  "mb-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.12em] text-[var(--pw-text-muted)]";
const SMALL = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const QUIET_BUTTON = `${LINK_BASE} border border-[var(--pw-border-subtle)] bg-transparent text-[var(--pw-text-primary)] disabled:opacity-60`;

export function RoomOffers({
  row,
  roomName,
  offers,
  headingId,
}: {
  row: RoomRow;
  roomName: string;
  offers: RoomOffer[];
  headingId: string;
}) {
  const action = useRoomAction();
  const [asking, setAsking] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ label: string; receipt: RoomActionReceipt } | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (asking || receipt) statusRef.current?.focus();
  }, [asking, receipt]);

  const send = (offer: RoomOffer) => {
    const label = offerLabel(offer);
    setReceipt(null);
    setAsking(label);
    action.mutate(
      { roomId: row.id, actionId: offer.id, body: {}, key: idempotencyKey() },
      {
        onSuccess: (r) => {
          setAsking(null);
          setReceipt({ label, receipt: r });
        },
        onError: () => {
          setAsking(null);
          setReceipt({
            label,
            receipt: { action_id: offer.id, ok: false, summary: "Couldn’t reach Worlds, so nothing changed.", changed: [], at: null },
          });
        },
      },
    );
  };

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className={SECTION_TITLE}>
        {`Ask ${roomName} to`}
      </h3>
      <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
        {offers.map((o) => (
          <button key={o.id} type="button" disabled={asking !== null} onClick={() => send(o)} className={QUIET_BUTTON}>
            {offerLabel(o)}
          </button>
        ))}
      </div>
      {asking && (
        <p ref={statusRef} tabIndex={-1} role="status" className={`${SMALL} mt-[var(--pw-spacing-sm)] focus:outline-none`}>
          {`Asking… Waiting for ${roomName} to answer “${asking}”.`}
        </p>
      )}
      {!asking && receipt && (
        <p
          ref={statusRef}
          tabIndex={-1}
          role={receipt.receipt.ok ? "status" : "alert"}
          className={`${SMALL} mt-[var(--pw-spacing-sm)] focus:outline-none`}
        >
          <span className="font-semibold text-[var(--pw-text-primary)]">
            {receipt.receipt.ok ? "Done. " : "Nothing changed. "}
          </span>
          {receipt.receipt.summary}
          {receipt.receipt.ok && receipt.receipt.at ? ` (${formatTime(receipt.receipt.at)})` : ""}
        </p>
      )}
    </section>
  );
}
