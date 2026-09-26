/**
 * CompanionMessage — one short line from the person's companion when
 * something meaningful happened since they were here (canvas board
 * Companion-Messages, 2026-09-26).
 *
 *   - Only meaningful events: things that arrived, and things that need
 *     you. Never polls, clocks or the companion itself. A quiet day says
 *     nothing at all.
 *   - At most one every 30 seconds: a newer message waits for the gap,
 *     and whatever is true then is what it says (batched).
 *   - Always dismissible; dismissing loses nothing (it's all still on the
 *     Bridge) and the same news never comes back.
 *   - Spoken by the chosen companion; crew off, Worlds' plain voice with
 *     Sol's mark. A polite status region, under the same 30-second cap.
 */
import { useEffect, useState } from "react";
import type { BridgeData } from "../../data/contract";
import type { Message } from "./companionMessages";
import { useFirstDayProgress } from "./firstDay";
import { CompanionFace } from "../../components/crew/CompanionFace";
import { SolMoment } from "../../components/SolMoment";
import { LINK_BASE } from "../../components/rooms/format";
import {
  composeMessage,
  dismissMessage,
  lastShownAt,
  markShown,
  MESSAGE_GAP_MS,
  useDismissedMessage,
  useMessagesMode,
} from "./companionMessages";

export function CompanionMessage({ data }: { data: BridgeData }) {
  const quiet = useFirstDayProgress(data).showing;
  const mode = useMessagesMode();
  const dismissed = useDismissedMessage();
  // Quiet while the first-day guide is speaking: one voice at a time.
  const candidate = mode === "off" || quiet ? null : composeMessage(data, mode);
  const wanted = candidate && candidate.key !== dismissed ? candidate : null;
  const [shown, setShown] = useState<Message | null>(null);

  // Enforce the gap: a new message appears now if 30 seconds have passed
  // since the last one, otherwise when they have.
  useEffect(() => {
    if (!wanted || wanted.key === shown?.key) return;
    const wait = Math.max(0, lastShownAt() + MESSAGE_GAP_MS - Date.now());
    const timer = window.setTimeout(() => {
      markShown(Date.now());
      setShown(wanted);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [wanted, shown?.key]);

  const visible = shown && wanted && shown.key === wanted.key ? shown : null;
  const speaker = data.keeper.resident;
  const crewOn = speaker.key !== null;
  const who = crewOn ? speaker.name : "Worlds";

  return (
    <div role="status" aria-live="polite" className="bridge-message empty:hidden">
      {visible && (
        <div className="flex flex-wrap items-center gap-[var(--pw-spacing-md)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] px-[var(--pw-spacing-lg)] py-[var(--pw-spacing-md)]">
          {crewOn ? (
            <CompanionFace
              name={speaker.name}
              portrait={speaker.portrait ? `${import.meta.env.BASE_URL}${speaker.portrait.replace(/^\//, "")}` : undefined}
              size="sm"
            />
          ) : (
            <SolMoment mood="mark" size={36} />
          )}
          <p className="min-w-[12rem] flex-1 text-[var(--pw-text-primary)]">
            <b>{`${who}: `}</b>
            {visible.text}
          </p>
          <button
            type="button"
            onClick={() => dismissMessage(visible.key)}
            className={`${LINK_BASE} border border-[var(--pw-border-subtle)] bg-transparent text-[var(--pw-text-primary)]`}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
