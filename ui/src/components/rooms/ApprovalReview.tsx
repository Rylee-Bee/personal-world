/**
 * Approving from Worlds (board Spec-Approve, open-items #1). A need the
 * Workshop can decide here gets "Approve or decline"; it opens a short
 * review whose focus starts on the safe choice, "Not now". Pressing
 * Approve or Decline sends one action with a fresh Idempotency-Key and
 * says "Approving…" (static, no spinner) until the room's receipt comes
 * back. "Approved" is only ever shown from that receipt (the drawer
 * shows it, because the need itself disappears); a refusal says
 * "Nothing changed" with the room's own reason.
 */
import { useEffect, useRef, useState } from "react";
import { useRoomAction } from "../../data/hooks";
import type { RoomActionReceipt, RoomNeed } from "../../data/contract";
import { idempotencyKey, LINK_BASE } from "./format";

type Verb = "approve" | "decline";
type Phase = "closed" | "review" | "sending" | "refused";

const SMALL = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const QUIET_BUTTON = `${LINK_BASE} border border-[var(--pw-border-subtle)] bg-transparent text-[var(--pw-text-primary)]`;
const HEADING =
  "text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]";

export function ApprovalReview({
  roomId,
  roomName,
  need,
  approval,
  onDecided,
}: {
  roomId: string;
  roomName: string;
  need: RoomNeed;
  approval: string;
  onDecided: (verb: Verb, receipt: RoomActionReceipt) => void;
}) {
  const action = useRoomAction();
  const [phase, setPhase] = useState<Phase>("closed");
  const [verb, setVerb] = useState<Verb>("approve");
  const [refusal, setRefusal] = useState<string>("");
  const safeRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);

  useEffect(() => {
    if (phase === "review") safeRef.current?.focus();
    else if (phase === "sending" || phase === "refused") statusRef.current?.focus();
    else if (opened.current) openRef.current?.focus();
  }, [phase]);

  const send = (v: Verb) => {
    setVerb(v);
    setPhase("sending");
    action.mutate(
      { roomId, actionId: v, body: { approval_id: approval }, key: idempotencyKey() },
      {
        onSuccess: (receipt) => {
          if (receipt.ok) onDecided(v, receipt);
          else {
            setRefusal(receipt.summary);
            setPhase("refused");
          }
        },
        onError: () => {
          setRefusal(`Couldn’t reach Worlds, so nothing changed. It’s still waiting.`);
          setPhase("refused");
        },
      },
    );
  };

  if (phase === "closed") {
    return (
      <button
        ref={openRef}
        type="button"
        aria-label={`Approve or decline “${need.title}”`}
        onClick={() => {
          opened.current = true;
          setPhase("review");
        }}
        className={QUIET_BUTTON}
      >
        Approve or decline
      </button>
    );
  }

  const box =
    "flex w-full flex-col gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-md)]";

  if (phase === "sending") {
    return (
      <div className={box}>
        <p ref={statusRef} tabIndex={-1} role="status" className={HEADING}>
          {verb === "approve" ? "Approving…" : "Declining…"}
        </p>
        <p className={SMALL}>{`Waiting for ${roomName} to confirm.`}</p>
      </div>
    );
  }

  if (phase === "refused") {
    return (
      <div className={box}>
        <p ref={statusRef} tabIndex={-1} role="alert" className={HEADING}>
          Nothing changed
        </p>
        <p className={SMALL}>{refusal}</p>
        <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
          <button type="button" onClick={() => setPhase("review")} className={QUIET_BUTTON}>
            Review again
          </button>
        </div>
      </div>
    );
  }

  const questionId = `approve-${roomId}-${approval}`;
  return (
    <div role="group" aria-labelledby={questionId} className={box}>
      <p id={questionId} className={HEADING}>
        {`Approve “${need.title}”?`}
      </p>
      <p className={SMALL}>
        {`Approve tells ${roomName} to go ahead; decline tells it no. Nothing changes until ${roomName} confirms.`}
      </p>
      <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
        <button ref={safeRef} type="button" onClick={() => setPhase("closed")} className={QUIET_BUTTON}>
          Not now
        </button>
        <button type="button" onClick={() => send("decline")} className={QUIET_BUTTON}>
          Decline
        </button>
        <button
          type="button"
          onClick={() => send("approve")}
          className={`${LINK_BASE} bg-[var(--pw-accent-warm)] text-[var(--pw-surface-void)]`}
        >
          Approve
        </button>
      </div>
    </div>
  );
}
