/**
 * StarMap — the little world itself.
 *
 * The World Keeper's globe sits at the heart and speaks the briefing;
 * the crew stand around it, each on their own small deck, reporting
 * their part of the world. Personality is the presentation: who is
 * glowing, who is holding something for you, and who is honestly dim
 * because nothing is plugged in yet.
 *
 * Encoding (accessibility contract §1.3): state is carried by WORDS
 * ("3 new", "2 need you", "not set up yet") and by luminance (dim vs
 * lit), never by hue alone. Positions are deterministic so the world
 * always looks like itself. Motion (the gentle bob) runs only when the
 * person allows motion; the OS reduced-motion setting wins.
 */

import type { BridgeKeeper, BridgeSystem, BridgeSystemId } from "../../data/contract";
import { deckPosition } from "./geometry";
import { CompanionFace } from "../../components/crew/CompanionFace";

const DIM_STATUSES = new Set(["not_configured", "disabled"]);
const QUIET_STATUSES = new Set(["unavailable", "unknown", "stale"]);

function publicAsset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}

function deckNote(system: BridgeSystem, statusWord: string): string | null {
  const { arrivals, have_tos } = system.counts;
  if (DIM_STATUSES.has(system.status)) return "not set up yet";
  if (have_tos > 0) return `${have_tos} need you`;
  if (arrivals > 0) return `${arrivals} new`;
  if (QUIET_STATUSES.has(system.status)) return statusWord.toLowerCase();
  return null;
}

interface StarMapProps {
  keeper: BridgeKeeper;
  systems: BridgeSystem[];
  selectedId: BridgeSystemId | null;
  onSelect: (id: BridgeSystemId) => void;
  statusWord: (raw: string) => string;
}

export function StarMap({ keeper, systems, selectedId, onSelect, statusWord }: StarMapProps) {
  const greeting = keeper.greeting
    ? `${keeper.greeting}${keeper.name ? `, ${keeper.name}` : ""}.`
    : null;

  return (
    <div className="starmap" data-mood={keeper.mood}>
      <svg className="starmap__orbit" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <ellipse cx="50" cy="50" rx="38" ry="38" />
      </svg>

      {/* The Keeper — the one voice of the briefing: the person's chosen
          companion, the Assistant, or Worlds itself when the crew is off. */}
      <div className="starmap__keeper">
        {keeper.resident.portrait !== null ? (
          <img
            src={publicAsset(keeper.resident.portrait)}
            alt=""
            aria-hidden="true"
            className="starmap__globe"
          />
        ) : keeper.resident.key === null ? (
          /* Worlds speaks plainly (the crew is off): Sol's small mark
             beside the words, never a voice of her own (canon). */
          <img
            src={publicAsset("/assets/crew/256/sol-mark.webp")}
            alt=""
            aria-hidden="true"
            className="starmap__globe"
          />
        ) : (
          /* A chosen companion with no picture wears the crew commbadge. */
          <CompanionFace name={keeper.resident.name} size="lg" />
        )}
        <p className="starmap__speech" aria-live="polite" aria-atomic="true">
          {greeting && <span className="starmap__greeting">{greeting} </span>}
          <span>{keeper.line}</span>
        </p>
      </div>

      <ul role="list" className="starmap__crew">
        {systems.map((system, index) => {
          const pos = deckPosition(index, systems.length);
          const word = statusWord(system.status);
          const note = deckNote(system, word);
          const active = system.id === selectedId;
          const dim = DIM_STATUSES.has(system.status);
          const lit = system.counts.arrivals > 0 || system.counts.have_tos > 0;
          const resident = system.resident;
          // A hidden/gone companion is credited to no one: the label names
          // the system alone and the deck shows its plain emblem.
          const label = resident
            ? `${system.name} — ${resident.name} — ${word}, ${system.counts.arrivals} new, ${system.counts.have_tos} need you`
            : `${system.name} — ${word}, ${system.counts.arrivals} new, ${system.counts.have_tos} need you`;
          return (
            <li
              key={system.id}
              className="starmap__slot"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <button
                type="button"
                onClick={() => onSelect(system.id)}
                aria-current={active ? "true" : undefined}
                aria-label={label}
                className="starmap__deck"
                data-active={active || undefined}
                data-dim={dim || undefined}
                data-lit={lit || undefined}
                style={{ ["--bob-delay" as string]: `${index * -0.9}s` }}
              >
                {resident?.portrait != null && (
                  <img
                    src={publicAsset(resident.portrait)}
                    alt=""
                    aria-hidden="true"
                    className="starmap__figure"
                  />
                )}
                <span className="starmap__base" aria-hidden="true" />
                <span className="starmap__name" aria-hidden="true">
                  {system.name}
                </span>
                {note && (
                  <span
                    className="starmap__note"
                    data-kind={system.counts.have_tos > 0 && !dim ? "needs" : undefined}
                    aria-hidden="true"
                  >
                    {note}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
