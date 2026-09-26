/**
 * Answering a decision with one tap (ROOM 2.1.0, Play-Nice #40). A need
 * may carry `choices`: up to six short answers, the room's recommended
 * one first (its `why` then starts with "Recommended: …"). Each is a
 * button; a press sends `answer-decision` with `{need, choice}` and a
 * fresh Idempotency-Key, says "Answering…" (static, no spinner) until
 * the room's receipt comes back, and only the receipt says it was
 * recorded. A refusal says "Nothing changed" with the room's own words.
 *
 * Only someone who may approve gets buttons; everyone else sees the
 * choices as a plain list, so they know what's being decided.
 */
import { useEffect, useRef, useState } from "react";
import { useRoomAction } from "../../data/hooks";
import type { RoomActionReceipt, RoomNeed } from "../../data/contract";
import { idempotencyKey, LINK_BASE } from "./format";
import { ANSWER_ACTION, hasRecommendation } from "./choices";

const SMALL = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const QUIET_BUTTON = `${LINK_BASE} border border-[var(--pw-border-subtle)] bg-transparent text-[var(--pw-text-primary)]`;
const PRIMARY_BUTTON = `${LINK_BASE} bg-[var(--pw-accent-warm)] text-[var(--pw-surface-void)]`;
const HEADING =
  "text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]";

export function ChoiceAnswer({
  roomId,
  roomName,
  need,
  choices,
  canAnswer,
  onAnswered,
}: {
  roomId: string;
  roomName: string;
  need: RoomNeed;
  choices: string[];
  canAnswer: boolean;
  onAnswered: (choice: string, receipt: RoomActionReceipt) => void;
}) {
  const action = useRoomAction();
  const [sending, setSending] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const recommended = hasRecommendation(need);
  const labelId = `choices-${roomId}-${need.id}`;

  useEffect(() => {
    if (sending || refusal) statusRef.current?.focus();
  }, [sending, refusal]);

  if (!canAnswer) {
    return (
      <div className="flex flex-col gap-[var(--pw-spacing-xs)]">
        <p id={labelId} className={SMALL}>
          The choices:
        </p>
        <ul aria-labelledby={labelId} className={`${SMALL} list-disc pl-[var(--pw-spacing-lg)]`}>
          {choices.map((c, i) => (
            <li key={c}>{i === 0 && recommended ? `${c} (recommended)` : c}</li>
          ))}
        </ul>
        <p className={SMALL}>Only someone who can approve things here can answer.</p>
      </div>
    );
  }

  const send = (choice: string) => {
    setRefusal(null);
    setSending(choice);
    action.mutate(
      { roomId, actionId: ANSWER_ACTION, body: { need: need.id, choice }, key: idempotencyKey() },
      {
        onSuccess: (receipt) => {
          setSending(null);
          if (receipt.ok) onAnswered(choice, receipt);
          else setRefusal(receipt.summary || `${roomName} didn’t take that answer.`);
        },
        onError: () => {
          setSending(null);
          setRefusal("Couldn’t reach Worlds, so nothing changed. It’s still waiting.");
        },
      },
    );
  };

  if (sending) {
    return (
      <div className="flex flex-col gap-[var(--pw-spacing-xs)]">
        <p ref={statusRef} tabIndex={-1} role="status" className={HEADING}>
          Answering…
        </p>
        <p className={SMALL}>{`“${sending}”. Waiting for ${roomName} to confirm.`}</p>
      </div>
    );
  }

  return (
    <div role="group" aria-labelledby={labelId} className="flex w-full flex-col gap-[var(--pw-spacing-sm)]">
      <p id={labelId} className="sr-only">{`Answer “${need.title}”`}</p>
      {refusal && (
        <div className="flex flex-col gap-[var(--pw-spacing-xs)]">
          <p ref={statusRef} tabIndex={-1} role="alert" className={HEADING}>
            Nothing changed
          </p>
          <p className={SMALL}>{refusal}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
        {choices.map((c, i) => {
          const isRecommended = i === 0 && recommended;
          return (
            <button
              key={c}
              type="button"
              onClick={() => send(c)}
              className={isRecommended ? PRIMARY_BUTTON : QUIET_BUTTON}
            >
              {isRecommended ? `${c} (recommended)` : c}
            </button>
          );
        })}
      </div>
    </div>
  );
}
