/**
 * FirstDayGuide — the Bridge's first day aboard (canvas board FirstBridge,
 * owner-approved 2026-09-26).
 *
 * A new World has nothing plugged in; the guide welcomes the person and
 * shows how it fills in. Every line is LIVE — it reads the same data as
 * the Bridge — and nothing is ticked until it's true:
 *
 *   1. Connect your first room    (GET /api/rooms: any rows)
 *   2. Plug in your systems       (briefing systems that answer)
 *   3. Write your first note      (a journal entry the person wrote,
 *                                  provenance.source "user")
 *   4. Meet your crew             (a companion chosen; hidden when the
 *                                  crew is off)
 *
 * Spoken by the briefing's speaker: the chosen companion, the Assistant,
 * or Worlds' plain voice with Sol's small mark when the crew is off.
 * Hidden once put away (this device) or once every line is done; Settings
 * brings it back. No motion, no confetti: a finished line gets its tick.
 */
import { useId, useState, type ReactNode } from "react";
import { useJournalList, useRooms } from "../../data/hooks";
import type { BridgeData } from "../../data/contract";
import type { WorldAreaId } from "../../data/types";
import { CompanionFace } from "../../components/crew/CompanionFace";
import { RoomsExplainer } from "../../components/rooms/RoomsExplainer";
import { LINK_BASE } from "../../components/rooms/format";
import { ANSWERING, setFirstDayHidden, SYSTEM_ABOUT, useFirstDayHidden } from "./firstDay";

function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}

const BUTTON = `${LINK_BASE} border border-[var(--pw-border-subtle)] bg-transparent text-[var(--pw-text-primary)]`;

function Line({
  done,
  title,
  state,
  children,
  action,
}: {
  done: boolean;
  title: string;
  state: string;
  children: ReactNode;
  action: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-start gap-[var(--pw-spacing-md)] border-t border-[var(--pw-border-subtle)] py-[var(--pw-spacing-md)]">
      <span
        aria-hidden="true"
        className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--pw-radius-full)] font-bold ${
          done
            ? "bg-[var(--pw-accent-warm)] text-[var(--pw-surface-void)]"
            : "border-2 border-[var(--pw-text-muted)]"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      <div className="min-w-[14rem] flex-1">
        <p className="font-semibold text-[var(--pw-text-primary)]">{title}</p>
        <p
          className={`text-[length:var(--pw-typography-size_small)] font-semibold ${
            done ? "text-[var(--pw-accent-warm)]" : "text-[var(--pw-text-secondary)]"
          }`}
        >
          {done ? `Done · ${state}` : state}
        </p>
        <div className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">{children}</div>
      </div>
      <div className="shrink-0">{action}</div>
    </li>
  );
}

function SystemsExplainer({ data }: { data: BridgeData }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="flex flex-col items-start gap-[var(--pw-spacing-sm)]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className={BUTTON}
      >
        What each one does
      </button>
      <ul
        id={panelId}
        hidden={!open}
        className="max-w-[62ch] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
      >
        {data.systems.map((s) => (
          <li key={s.id} className="py-[var(--pw-spacing-xs)]">
            <span className="font-semibold text-[var(--pw-text-primary)]">{s.name}</span>
            {`: ${SYSTEM_ABOUT[s.id] ?? "One of your World’s systems."} `}
            <span className="text-[var(--pw-text-muted)]">
              {ANSWERING.has(s.status) ? "(answering)" : "(not answering yet)"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FirstDayGuide({
  data,
  onOpenArea,
  onOpenCrew,
}: {
  data: BridgeData;
  onOpenArea: (id: WorldAreaId) => void;
  onOpenCrew?: () => void;
}) {
  const hidden = useFirstDayHidden();
  const rooms = useRooms();
  const journal = useJournalList({ n: 200 });

  const speaker = data.keeper.resident;
  const crewOn = speaker.key !== null;
  const roomCount = rooms.data?.data?.length;
  const answering = data.systems.filter((s) => ANSWERING.has(s.status)).length;
  const wroteNote = (journal.data?.data ?? []).some((e) => e.provenance?.source === "user");
  const companionChosen = crewOn && speaker.key !== "assistant";

  const roomsDone = (roomCount ?? 0) > 0;
  const systemsDone = data.systems.length > 0 && answering === data.systems.length;
  const lines = [roomsDone, systemsDone, wroteNote, ...(crewOn ? [companionChosen] : [])];
  const allDone = lines.every(Boolean);

  // Until the rooms and journal reads settle, a line would claim "not
  // yet" without knowing; wait rather than guess.
  if (hidden || allDone || rooms.isPending || journal.isPending) return null;

  const who = crewOn ? speaker.name : "Worlds";
  const greetingName = data.keeper.name ? `, ${data.keeper.name}` : "";

  return (
    <section
      aria-labelledby="first-day-heading"
      className="bridge-firstday rounded-[var(--pw-radius-lg)] border border-[var(--pw-accent-warm)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
    >
      <div className="flex flex-wrap items-center gap-[var(--pw-spacing-md)]">
        {!crewOn ? (
          <img
            src={asset("/assets/crew/256/sol-mark.webp")}
            alt=""
            aria-hidden="true"
            className="h-16 w-16 shrink-0 object-contain"
          />
        ) : (
          <CompanionFace
            name={speaker.name}
            portrait={speaker.portrait ? asset(speaker.portrait) : undefined}
            size="lg"
          />
        )}
        <div className="min-w-[14rem] flex-1">
          <p className="text-[length:var(--pw-typography-size_label)] font-bold uppercase tracking-[0.14em] text-[var(--pw-accent-warm)]">
            First day aboard
          </p>
          <h2
            id="first-day-heading"
            className="text-[clamp(1.5rem,2.6vw,2rem)] font-semibold text-[var(--pw-text-primary)]"
            style={{ fontFamily: "var(--pw-typography-font_serif, inherit)" }}
          >
            {`Welcome aboard${greetingName}.`}
          </h2>
          <p className="text-[var(--pw-text-secondary)]">
            <span className="font-semibold text-[var(--pw-text-primary)]">{`${who}: `}</span>
            {roomsDone || answering > 1
              ? "Here’s what’s left before your World feels settled in."
              : "Nothing’s plugged in yet, so it’s quiet here. That’s normal on day one. Here’s how your World fills in."}
          </p>
        </div>
        <button type="button" onClick={() => setFirstDayHidden(true)} className={BUTTON}>
          Put this away
        </button>
      </div>

      <ol className="mt-[var(--pw-spacing-md)] list-none p-0">
        <Line
          done={roomsDone}
          title="Connect your first room"
          state={roomsDone ? `${roomCount} ${roomCount === 1 ? "room" : "rooms"} connected` : "No rooms yet"}
          action={<RoomsExplainer />}
        >
          A room is a small app that joins your World, like Workshop or Studio. When one
          connects, its door appears on the Bridge.
        </Line>
        <Line
          done={systemsDone}
          title="Plug in your systems"
          state={`${answering} of ${data.systems.length} answering`}
          action={<SystemsExplainer data={data} />}
        >
          The star map’s systems light up as their sources are connected. Until then they say so.
        </Line>
        <Line
          done={wroteNote}
          title="Write your first note"
          state={wroteNote ? "You’ve started your journal" : "Not yet"}
          action={
            <button type="button" onClick={() => onOpenArea("memory")} className={BUTTON}>
              Open Memory
            </button>
          }
        >
          Your journal and records live in Memory. One line is enough to start.
        </Line>
        {crewOn && (
          <Line
            done={companionChosen}
            title="Meet your crew"
            state={companionChosen ? `${speaker.name} is your companion` : "The Assistant is keeping you company"}
            action={
              onOpenCrew ? (
                <button type="button" onClick={onOpenCrew} className={BUTTON}>
                  Open your crew
                </button>
              ) : null
            }
          >
            Add your own companions, give them faces, and choose who keeps each room.
          </Line>
        )}
      </ol>
    </section>
  );
}
