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
import { Icon } from "../../components/Icon";
import { useEffect, useId, useState, type ReactNode } from "react";
import type { BridgeData } from "../../data/contract";
import type { WorldAreaId } from "../../data/types";
import { CompanionFace } from "../../components/crew/CompanionFace";
import { RoomsExplainer } from "../../components/rooms/RoomsExplainer";
import { LINK_BASE } from "../../components/rooms/format";
import { ANSWERING, markFirstDayShown, setFirstDayHidden, SETUP_FOR, SYSTEM_ABOUT, useFirstDayProgress, waitingOnWorlds, wasFirstDayShown } from "./firstDay";
import { SolMoment } from "../../components/SolMoment";
import { WorldDrawer } from "../../components/WorldDrawer";
import { CompanionChooser } from "../../components/crew/CompanionChooser";

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
        {done ? <Icon name="check" size={16} /> : null}
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

function SystemsExplainer({ data, onOpenArea }: { data: BridgeData; onOpenArea: (id: WorldAreaId) => void }) {
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
        What each one does, and where to set it up
      </button>
      <ul
        id={panelId}
        hidden={!open}
        className="max-w-[62ch] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
      >
        {data.systems.map((s) => {
          const setup = SETUP_FOR[s.id];
          const answering = ANSWERING.has(s.status);
          return (
            <li key={s.id} className="flex flex-col gap-[var(--pw-spacing-xs)] border-b border-[var(--pw-border-subtle)] py-[var(--pw-spacing-sm)] last:border-b-0">
              <span>
                <span className="font-semibold text-[var(--pw-text-primary)]">{s.name}</span>
                {`: ${SYSTEM_ABOUT[s.id] ?? "One of your World’s systems."} `}
                <span className="text-[var(--pw-text-muted)]">
                  {answering ? "(answering)" : waitingOnWorlds(s) ? "(not available yet)" : "(not answering yet)"}
                </span>
              </span>
              {!answering && setup ? (
                <span className="flex flex-wrap items-center gap-[var(--pw-spacing-sm)]">
                  <span>{setup.how}</span>
                  {setup.area ? (
                    <button type="button" onClick={() => onOpenArea(setup.area!)} className={BUTTON}>
                      {setup.label}
                    </button>
                  ) : null}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SettledIn() {
  return (
    <section
      aria-labelledby="settled-in-heading"
      className="bridge-firstday flex flex-wrap items-center gap-[var(--pw-spacing-md)] rounded-[var(--pw-radius-lg)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
    >
      <SolMoment mood="proud" size={72} />
      <div className="min-w-[14rem] flex-1">
        <h2
          id="settled-in-heading"
          className="text-[length:var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-primary)]"
          style={{ fontFamily: "var(--pw-typography-font_serif, inherit)" }}
        >
          You’re all settled in.
        </h2>
        <p className="text-[var(--pw-text-secondary)]">
          Rooms are connected, your systems are answering and your journal has begun.
        </p>
      </div>
      <button type="button" onClick={() => setFirstDayHidden(true)} className={BUTTON}>
        Put this away
      </button>
    </section>
  );
}

export function FirstDayGuide({
  data,
  onOpenArea,
  onOpenCrew,
  onOpenLibrary,
}: {
  data: BridgeData;
  onOpenArea: (id: WorldAreaId) => void;
  onOpenCrew?: () => void;
  onOpenLibrary?: () => void;
}) {
  const {
    hidden,
    settling,
    showing,
    allDone,
    speaker,
    crewOn,
    roomCount,
    answering,
    countable,
    wroteNote,
    companionChosen,
    roomsDone,
    systemsDone,
  } = useFirstDayProgress(data);
  const [choosing, setChoosing] = useState(false);
  useEffect(() => {
    if (showing) markFirstDayShown();
  }, [showing]);

  // Until the rooms and journal reads settle, a line would claim "not
  // yet" without knowing; wait rather than guess.
  if (hidden || settling) return null;
  if (allDone) {
    // Everything's in: one quiet moment with Sol, only on a device that
    // showed the guide (so an already-settled World never gets a surprise).
    return wasFirstDayShown() ? <SettledIn /> : null;
  }

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
          state={`${answering} of ${countable} answering`}
          action={<SystemsExplainer data={data} onOpenArea={onOpenArea} />}
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
              <span className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
                <button type="button" onClick={() => setChoosing(true)} className={BUTTON}>
                  Choose your companion
                </button>
                {onOpenCrew ? (
                  <button type="button" onClick={onOpenCrew} className={BUTTON}>
                    Open your crew
                  </button>
                ) : null}
              </span>
            }
          >
            Choose who keeps you company. Later, add your own companions, give them faces, and choose who keeps each room.
          </Line>
        )}
      </ol>
      <WorldDrawer isOpen={choosing} onClose={() => setChoosing(false)} title="Choose your companion">
        {choosing ? <CompanionChooser /> : null}
      </WorldDrawer>
      {onOpenLibrary && (
        <p className="mt-[var(--pw-spacing-md)] flex flex-wrap items-center gap-[var(--pw-spacing-sm)] border-t border-[var(--pw-border-subtle)] pt-[var(--pw-spacing-md)] text-[var(--pw-text-secondary)]">
          <span>Want to know how this works?</span>
          <button type="button" onClick={onOpenLibrary} className={BUTTON}>
            Open the Library
          </button>
        </p>
      )}
    </section>
  );
}
