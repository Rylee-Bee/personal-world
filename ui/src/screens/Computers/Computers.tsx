/**
 * Computers: a calm map of what you have (owner ask, 2026-09-27: "I'd love
 * a visual of that"). Not a network diagram: each machine is a little
 * place with its one plain line and a status in words; the big host holds
 * its virtual machines and containers. What runs is grouped by what it's
 * for. Your devices, your rooms (as doorways) and your projects (a shelf)
 * sit beside them. Read live from the Engine room's estate view.
 *
 * Staleness is part of the design: "checked N min ago"; something new
 * glows gently and asks what it's for; something that seems gone looks
 * faded; "not checked" never looks healthy, and neither does "reachable".
 * Private: machine names and roles are the owner's; no addresses are shown.
 */
import { reportSticker } from "../../components/stickers/report";
import { useEffect, useId, type ReactNode } from "react";
import { useRoomView, useRooms } from "../../data/hooks";
import { isUncertain } from "../../components/rooms/groupRooms";
import { relativeTime } from "../../components/rooms/format";
import { useMinuteClock } from "../../components/rooms/useRootAttribute";
import { SolMoment } from "../../components/SolMoment";
import { Icon } from "../../components/Icon";
import { Loading } from "../../components/Loading";

const ROOM = "engine-room";
const STALE_MIN = 30;

type Drift = null | "new" | "gone?";
interface Machine { name: string; what?: string; kind?: "host" | "vm" | "container" | "machine" | string; status?: string; drift?: Drift }
interface Group { name: string; what?: string; services?: string[]; drift?: Drift }
interface Device { name: string; status?: "connected" | "idle" | "never" | string; last_seen?: string | null }
interface Estate {
  generated_at?: string;
  machines?: Machine[];
  machines_source?: string;
  groups?: Group[];
  rooms?: { id: string; name: string }[];
  projects?: { id: string; name: string; what?: string }[];
  devices?: Device[];
  devices_source?: "vpn" | "unavailable" | string;
  drift?: unknown;
}

const SERIF = { fontFamily: "var(--pw-typography-font_serif, inherit)" } as const;
const SMALL = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const H2 = "text-[length:var(--pw-typography-size_h2,var(--pw-typography-size_lead))] font-semibold text-[var(--pw-text-primary)]";

/** Status in words, and how it looks. Only "running" and "connected" look well. */
function statusOf(status: string | undefined): { words: string; tone: "good" | "quiet" | "warn" | "unknown" } {
  switch (status) {
    case "running":
      return { words: "Running", tone: "good" };
    case "stopped":
      return { words: "Stopped", tone: "quiet" };
    case "not found":
      return { words: "Not found", tone: "warn" };
    case "not answering":
      return { words: "Not answering", tone: "warn" };
    case "reachable":
      return { words: "Reachable (not checked inside)", tone: "unknown" };
    case "this machine":
      return { words: "This machine (where Worlds runs)", tone: "unknown" };
    case "connected":
      return { words: "Connected", tone: "good" };
    case "idle":
      return { words: "Idle", tone: "quiet" };
    case "never":
      return { words: "Never connected", tone: "unknown" };
    case "not checked":
    default:
      return { words: "Not checked", tone: "unknown" };
  }
}

function Status({ status }: { status?: string }) {
  const s = statusOf(status);
  return (
    <span className={`estate-status estate-status-${s.tone} ${SMALL}`}>
      <span aria-hidden="true" className="estate-dot" />
      {s.words}
    </span>
  );
}

const KIND_WORDS: Record<string, string> = {
  host: "Host (holds virtual machines)",
  vm: "Virtual machine",
  container: "Container",
  machine: "Machine",
};

function DriftNote({ drift }: { drift?: Drift }) {
  if (drift === "new") return <p className="estate-drift-new text-[length:var(--pw-typography-size_small)]">Something new. What’s it for?</p>;
  if (drift === "gone?") return <p className={SMALL}>This seems gone. It may be archived.</p>;
  return null;
}

function Place({ m, children }: { m: Machine; children?: ReactNode }) {
  return (
    <li className={`estate-place ${m.drift === "new" ? "estate-new" : ""} ${m.drift === "gone?" ? "estate-gone" : ""} ${children ? "estate-host" : ""}`}>
      <div className="flex flex-wrap items-start gap-x-[var(--pw-spacing-md)] gap-y-[var(--pw-spacing-xs)]">
        <Icon name="desktop" size={24} className="mt-[2px] shrink-0 text-[var(--pw-accent-warm)]" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)]" style={SERIF}>
            {m.name}
          </h3>
          {m.what ? <p className="text-[var(--pw-text-secondary)]">{m.what}</p> : null}
          <p className={`${SMALL} mt-[var(--pw-spacing-xs)] flex flex-wrap gap-x-[var(--pw-spacing-md)]`}>
            <span>{KIND_WORDS[m.kind ?? ""] ?? "Machine"}</span>
            <Status status={m.status} />
          </p>
          <DriftNote drift={m.drift} />
        </div>
      </div>
      {children}
    </li>
  );
}

const DOORWAYS: Record<string, string> = {
  "hive-works": "hive-works-doorway",
  vefr: "vefr-doorway",
  workshop: "workshop-doorway",
  "project-home": "workshop-doorway",
  memomancer: "memomancer-doorway",
  "play-nice": "play-nice-doorway",
  "engine-room": "doorway-servers",
  candy: "doorway-kitchen",
  studio: "doorway-study",
};

export function Computers() {
  useEffect(() => {
    void reportSticker("cartographer");
  }, []);
  const rooms = useRooms();
  const row = (rooms.data?.data ?? []).find((r) => r.id === ROOM) ?? null;
  const live = row !== null && !isUncertain(row);
  const view = useRoomView<Estate>(ROOM, "estate", undefined, live);
  const now = useMinuteClock();
  const id = useId();
  const e = view.data?.data;
  const checked = e?.generated_at;
  const stale = checked ? now - Date.parse(checked) > STALE_MIN * 60_000 : false;

  const machines = e?.machines ?? [];
  const hosts = machines.filter((m) => m.kind === "host");
  const guests = machines.filter((m) => m.kind === "vm" || m.kind === "container");
  const others = machines.filter((m) => m.kind !== "host" && m.kind !== "vm" && m.kind !== "container");
  // One host holds the guests. With several hosts we can't tell which is
  // whose, so the guests get a place of their own rather than a guess.
  const nest = hosts.length === 1;
  const news = [...machines, ...(e?.groups ?? [])].filter((x) => x.drift === "new").length;
  const gones = [...machines, ...(e?.groups ?? [])].filter((x) => x.drift === "gone?").length;

  const header = (
    <header className="mb-[var(--pw-spacing-xl)] flex flex-wrap items-center gap-[var(--pw-spacing-lg)]">
      <img src={`${import.meta.env.BASE_URL}assets/crew/256/doorway-servers.webp`} alt="" aria-hidden="true" className="h-[96px] w-auto shrink-0" />
      <div className="min-w-[14rem] flex-1">
        <h1 className="text-[length:var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]" style={SERIF}>
          Computers
        </h1>
        <p className="max-w-[62ch] text-[var(--pw-text-secondary)]">What you have: your machines, what runs on them, your devices, rooms and projects.</p>
        {live && checked ? (
          <p className={SMALL}>
            {`Checked ${relativeTime(checked, now)}`}
            {stale ? " · this may be out of date" : ""}
          </p>
        ) : null}
      </div>
    </header>
  );

  let body: ReactNode;
  if (rooms.isPending) body = <Loading words="Finding the Engine room…" minWidth={260} />;
  else if (!row || !live || view.isError) {
    body = (
      <div className="flex items-center gap-[var(--pw-spacing-md)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] p-[var(--pw-spacing-lg)]">
        <SolMoment mood="sleeping" size={56} />
        <p className="text-[var(--pw-text-secondary)]">
          {!row
            ? "This map comes from the Engine room, and it isn’t connected to this World yet."
            : "Worlds can’t reach the Engine room right now, so nothing here is current. It will fill in when it answers."}
        </p>
      </div>
    );
  } else if (view.isPending) body = <Loading words="Looking at what you have…" cards={6} minWidth={260} />;
  else {
    body = (
      <div className="flex flex-col gap-[var(--pw-spacing-2xl)]">
        {(news > 0 || gones > 0) && (
          <p className="estate-drift-summary rounded-[var(--pw-radius-md)] p-[var(--pw-spacing-md)] text-[var(--pw-text-primary)]">
            {[news ? `${news} new ${news === 1 ? "thing" : "things"} to say what ${news === 1 ? "it’s" : "they’re"} for` : null, gones ? `${gones} that ${gones === 1 ? "seems" : "seem"} gone` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        <section aria-labelledby={`${id}-m`} className="flex flex-col gap-[var(--pw-spacing-md)]">
          <h2 id={`${id}-m`} className={H2} style={SERIF}>Machines</h2>
          {e?.machines_source === "unavailable" ? <p className={SMALL}>The list of machines couldn’t be read just now.</p> : null}
          {machines.length === 0 ? (
            <p className={SMALL}>No machines found yet.</p>
          ) : (
            <ul className="estate-map">
              {hosts.map((h) => (
                <Place key={h.name} m={h}>
                  {nest && guests.length > 0 ? (
                    <ul aria-label={`Inside ${h.name}`} className="estate-inside">
                      {guests.map((g) => <Place key={g.name} m={g} />)}
                    </ul>
                  ) : null}
                </Place>
              ))}
              {!nest && guests.map((g) => <Place key={g.name} m={g} />)}
              {others.map((m) => <Place key={m.name} m={m} />)}
            </ul>
          )}
        </section>

        {(e?.groups?.length ?? 0) > 0 && (
          <section aria-labelledby={`${id}-g`} className="flex flex-col gap-[var(--pw-spacing-md)]">
            <h2 id={`${id}-g`} className={H2} style={SERIF}>What runs</h2>
            <ul className="grid gap-[var(--pw-spacing-md)] sm:grid-cols-2 lg:grid-cols-3">
              {e!.groups!.map((g) => (
                <li key={g.name} className={`estate-place ${g.drift === "new" ? "estate-new" : ""} ${g.drift === "gone?" ? "estate-gone" : ""}`}>
                  <h3 className="font-semibold text-[var(--pw-text-primary)]">{g.name}</h3>
                  {g.what ? <p className="text-[var(--pw-text-secondary)]">{g.what}</p> : null}
                  {g.services?.length ? (
                    <details className="mt-[var(--pw-spacing-xs)]">
                      <summary className={`${SMALL} flex min-h-[var(--pw-targets-minimum)] cursor-pointer items-center rounded-[var(--pw-radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]`}>
                        {`${g.services.length} ${g.services.length === 1 ? "service" : "services"}`}
                      </summary>
                      <p className={SMALL}>{g.services.join(", ")}</p>
                    </details>
                  ) : null}
                  <DriftNote drift={g.drift} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby={`${id}-d`} className="flex flex-col gap-[var(--pw-spacing-md)]">
          <h2 id={`${id}-d`} className={H2} style={SERIF}>Your devices</h2>
          {e?.devices_source === "unavailable" || !e?.devices ? (
            <p className={SMALL}>Your devices couldn’t be read just now.</p>
          ) : e.devices.length === 0 ? (
            <p className={SMALL}>No devices yet.</p>
          ) : (
            <ul className="grid gap-[var(--pw-spacing-md)] sm:grid-cols-2 lg:grid-cols-3">
              {e.devices.map((d) => (
                <li key={d.name} className="estate-place">
                  <h3 className="font-semibold text-[var(--pw-text-primary)]">{d.name}</h3>
                  <p className={`${SMALL} flex flex-wrap gap-x-[var(--pw-spacing-md)]`}>
                    <Status status={d.status} />
                    {d.last_seen ? <span>{`last seen ${relativeTime(d.last_seen, now)}`}</span> : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {(e?.rooms?.length ?? 0) > 0 && (
          <section aria-labelledby={`${id}-r`} className="flex flex-col gap-[var(--pw-spacing-md)]">
            <h2 id={`${id}-r`} className={H2} style={SERIF}>Your rooms</h2>
            <ul className="estate-doors">
              {e!.rooms!.map((r) => (
                <li key={r.id} className="flex flex-col items-center gap-[var(--pw-spacing-xs)] text-center">
                  <img src={`${import.meta.env.BASE_URL}assets/crew/256/${DOORWAYS[r.id] ?? "doorway-hallway"}.webp`} alt="" aria-hidden="true" className="h-[88px] w-auto" />
                  <span className="text-[var(--pw-text-primary)]">{r.name}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(e?.projects?.length ?? 0) > 0 && (
          <section aria-labelledby={`${id}-p`} className="flex flex-col gap-[var(--pw-spacing-md)]">
            <h2 id={`${id}-p`} className={H2} style={SERIF}>Your projects</h2>
            <ul className="estate-shelf">
              {e!.projects!.map((p) => (
                <li key={p.id} className="estate-spine">
                  <span className="font-semibold text-[var(--pw-text-primary)]" style={SERIF}>{p.name}</span>
                  {p.what ? <span className={SMALL}>{p.what}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className={`${SMALL} rounded-[var(--pw-radius-md)] border border-dashed border-[var(--pw-border-subtle)] p-[var(--pw-spacing-md)]`}>
          Soon: ask the Engine room to do basic things for you, like running a backup. Anything hard to undo will wait for you to tap.
        </p>
      </div>
    );
  }

  return (
    <main id="main-content" aria-label="Computers" className="relative z-10 max-w-[1180px] p-[var(--pw-spacing-xl)] md:p-[var(--pw-spacing-3xl)]">
      {header}
      {body}
    </main>
  );
}
