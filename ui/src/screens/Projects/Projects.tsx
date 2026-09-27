/**
 * Projects — the Hive Works company, inside Worlds (owner, 2026-09-27:
 * "make that the projects page").
 *
 * Teams, then their projects, then one project's tickets, and the bee
 * crew who run them. Everything is Hive Works' own read-only views
 * (GET /api/rooms/hive-works/views/…), refreshed the moment Hive Works
 * changes (useRoomEvents invalidates every room view), so there is no
 * refresh button: just a quiet "updated just now".
 *
 * Deciding things stays where it is: what needs you, merges and Riff
 * live in the Hive Works drawer, one press away from this page. Links
 * open on the Hive Works site in a new tab. When Hive Works isn't
 * connected or isn't answering, the page says so in words and shows
 * nothing as current.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useRoomView, useRooms } from "../../data/hooks";
import type {
  HiveBee,
  HiveClosedTicket,
  HiveCrewView,
  HiveProject,
  HiveProjectView,
  HiveProjectsView,
  HiveTeam,
  HiveTeamsView,
  HiveTicket,
  RoomRow,
} from "../../data/contract";
import { relativeTime, roomItemUrl } from "../../components/rooms/format";
import { artName } from "../../components/rooms/choices";
import { roomArtUrl } from "../../data/api";
import { useMinuteClock } from "../../components/rooms/useRootAttribute";
import { currentNeeds, isUncertain } from "../../components/rooms/groupRooms";
import { RoomDrawer } from "../../components/rooms/RoomDrawer";
import { SpotArt } from "../../components/SpotArt";
import { Icon } from "../../components/Icon";
import { WorldButton } from "../../components/WorldButton";

const HIVE_ROOM = "hive-works";

const SERIF = { fontFamily: "var(--pw-typography-font_serif, inherit)" } as const;
const SMALL = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const MICRO = "text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]";
const EYEBROW =
  "text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.12em] text-[var(--pw-accent-warm)]";
const CARD =
  "flex min-w-0 flex-col gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]";
const LINK =
  "inline-flex min-h-[var(--pw-targets-minimum)] items-center gap-[var(--pw-spacing-xs)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] px-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]";
const CHIP_ON =
  "inline-flex min-h-[var(--pw-targets-minimum)] items-center gap-[var(--pw-spacing-sm)] rounded-full border border-[var(--pw-accent-warm)] bg-[var(--pw-accent-warm_soft)] px-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-text-primary)]";
const CHIP_OFF =
  "inline-flex min-h-[var(--pw-targets-minimum)] items-center gap-[var(--pw-spacing-sm)] rounded-full border border-[var(--pw-border-subtle)] px-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** A bee's face, served through Worlds (so it shows without a Hive Works
 *  sign-in), or their initial in a ring when there is no picture (or it
 *  doesn't load). Decorative: the name is always in the words beside it. */
function BeeFace({
  row,
  bee,
  file,
  size = 40,
}: {
  row: RoomRow;
  bee: HiveBee | undefined;
  /** A face file to use when the bee isn't in the crew list (teams). */
  file?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const name = artName(bee?.face_file ?? file);
  const src = name ? roomArtUrl(row.id, name) : null;
  const initial = (bee?.name ?? "?").trim().charAt(0).toUpperCase() || "?";
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        onError={() => setFailed(true)}
        className="shrink-0 rounded-full border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full border border-[var(--pw-accent-warm)] bg-[var(--pw-surface-hull)] font-semibold text-[var(--pw-text-primary)]"
      style={{ width: size, height: size, ...SERIF }}
    >
      {initial}
    </span>
  );
}

function OpenOnSite({ row, link, label }: { row: RoomRow; link: string | null; label: string }) {
  const href = roomItemUrl(row, link);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK} aria-label={`${label}, on the Hive Works site, in a new tab`}>
      {label}
      <Icon name="external" size={16} />
    </a>
  );
}

/** Hive Works' own status line when it sends one (shown as is), else our counts. */
function projectWords(p: HiveProject): string {
  if (p.status_line?.trim()) return p.status_line.trim();
  const parts = [plural(p.open, "open ticket", "open tickets")];
  if (p.decisions_open > 0) parts.push(plural(p.decisions_open, "decision waiting", "decisions waiting"));
  if (p.stale > 0) parts.push(`${p.stale} gone quiet`);
  parts.push(`${p.closed} closed in all`);
  return parts.join(" · ");
}

function ShippedLine({ p, now }: { p: HiveProject; now: number }) {
  const bits: string[] = [];
  if (typeof p.closed_this_week === "number" && p.closed_this_week > 0) {
    bits.push(`${plural(p.closed_this_week, "ticket", "tickets")} closed this week`);
  }
  if (p.last_shipped) {
    bits.push(`Last shipped: ${p.last_shipped.what} (${p.last_shipped.hw}), ${relativeTime(p.last_shipped.at, now)}`);
  }
  if (bits.length === 0) return null;
  return (
    <p className={`${SMALL} flex items-start gap-[var(--pw-spacing-xs)]`}>
      <Icon name="check" size={16} className="mt-[3px] shrink-0 text-[var(--pw-accent-warm)]" />
      <span>{bits.join(" · ")}</span>
    </p>
  );
}

function ClosedRow({ row, t, now }: { row: RoomRow; t: HiveClosedTicket; now: number }) {
  const dropped = t.status === "dropped";
  return (
    <li className="flex flex-col gap-[var(--pw-spacing-xs)] border-t border-[var(--pw-border-subtle)] py-[var(--pw-spacing-md)]">
      <span className="flex flex-wrap items-baseline gap-x-[var(--pw-spacing-sm)]">
        <span className="font-mono text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">{t.hw}</span>
        <span className={`text-[length:var(--pw-typography-size_body)] ${dropped ? "text-[var(--pw-text-secondary)]" : "font-semibold text-[var(--pw-text-primary)]"}`}>
          {t.what}
        </span>
      </span>
      <span className={SMALL}>
        {[dropped ? "Dropped: won’t be done" : "Shipped", t.closed_at ? relativeTime(t.closed_at, now) : null]
          .filter(Boolean)
          .join(" · ")}
      </span>
      {t.link ? (
        <span>
          <OpenOnSite row={row} link={t.link} label={`Open ${t.hw}`} />
        </span>
      ) : null}
    </li>
  );
}

function TicketRow({ row, t }: { row: RoomRow; t: HiveTicket }) {
  return (
    <li className="flex flex-col gap-[var(--pw-spacing-xs)] border-t border-[var(--pw-border-subtle)] py-[var(--pw-spacing-md)]">
      <span className="flex flex-wrap items-baseline gap-x-[var(--pw-spacing-sm)]">
        <span className="font-mono text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">{t.hw}</span>
        <span className="text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)]">{t.what}</span>
      </span>
      <span className={SMALL}>
        {[t.stage && `Stage: ${t.stage}`, t.owner && `With ${t.owner}`, t.freedom && `Freedom: ${t.freedom}`]
          .filter(Boolean)
          .join(" · ")}
      </span>
      {t.done_when ? <span className={SMALL}>{`Done when: ${t.done_when}`}</span> : null}
      {t.link ? (
        <span>
          <OpenOnSite row={row} link={t.link} label={`Open ${t.hw}`} />
        </span>
      ) : null}
    </li>
  );
}

function ProjectTickets({
  row,
  project,
  onBack,
}: {
  row: RoomRow;
  project: HiveProject;
  onBack: () => void;
}) {
  const view = useRoomView<HiveProjectView | { generated_at: string; projects: HiveProjectView["project"] }>(
    HIVE_ROOM,
    "projects",
    project.id,
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const data = view.data?.data;
  const full = data ? ("project" in data ? data.project : data.projects) : undefined;
  const tickets = Array.isArray(full?.tickets) ? full.tickets : [];
  const backlog = tickets.filter((t) => t.status !== "someday");
  const someday = tickets.filter((t) => t.status === "someday");
  const closed = Array.isArray(full?.closed_tickets) ? full.closed_tickets : [];
  const shipped = closed.filter((t) => t.status !== "dropped").length;
  const now = useMinuteClock();
  const id = useId();

  return (
    <section aria-labelledby={`${id}-h`} className="flex flex-col gap-[var(--pw-spacing-lg)]">
      <WorldButton variant="ghost" onPress={onBack} className="self-start">
        <Icon name="back" size={16} className="mr-[var(--pw-spacing-xs)]" />
        All projects
      </WorldButton>
      <div className="flex flex-wrap items-center gap-[var(--pw-spacing-md)]">
        <div className="min-w-0 flex-1">
          <p className={EYEBROW}>Project</p>
          <h2
            id={`${id}-h`}
            ref={headingRef}
            tabIndex={-1}
            className="text-[length:var(--pw-typography-size_h2,var(--pw-typography-size_lead))] font-semibold text-[var(--pw-text-primary)] focus:outline-none"
            style={SERIF}
          >
            {project.name}
          </h2>
          <p className={SMALL}>{projectWords(full ?? project)}</p>
          <ShippedLine p={full ?? project} now={now} />
        </div>
        <OpenOnSite row={row} link={project.link} label="Open in Hive Works" />
      </div>
      {view.isPending ? (
        <p className={SMALL}>Finding the tickets…</p>
      ) : view.isError ? (
        <p className={SMALL}>Couldn’t load this project’s tickets just now. Nothing here is current.</p>
      ) : (
        <>
          {tickets.length === 0 && (
            <p className={SMALL}>No open tickets. Everything here is done or hasn’t started.</p>
          )}
          {backlog.length > 0 && (
            <section aria-labelledby={`${id}-backlog`} className={CARD}>
              <h3 id={`${id}-backlog`} className={EYEBROW}>{`Backlog · ${backlog.length}`}</h3>
              <ul>{backlog.map((t) => <TicketRow key={t.hw} row={row} t={t} />)}</ul>
            </section>
          )}
          {someday.length > 0 && (
            <section aria-labelledby={`${id}-someday`} className={CARD}>
              <h3 id={`${id}-someday`} className={EYEBROW}>{`Someday · ${someday.length}`}</h3>
              <ul>{someday.map((t) => <TicketRow key={t.hw} row={row} t={t} />)}</ul>
            </section>
          )}
          {closed.length > 0 && (
            <details className={CARD}>
              <summary className="flex min-h-[var(--pw-targets-minimum)] cursor-pointer items-center gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]">
                <span className={EYEBROW}>{`Closed · ${closed.length}`}</span>
                <span className={SMALL}>
                  {closed.length === shipped
                    ? `${shipped} shipped`
                    : `${shipped} shipped · ${closed.length - shipped} dropped`}
                </span>
              </summary>
              <ul>{closed.map((t) => <ClosedRow key={t.hw} row={row} t={t} now={now} />)}</ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

export function Projects() {
  const rooms = useRooms();
  const now = useMinuteClock();
  const row = (rooms.data?.data ?? []).find((r) => r.id === HIVE_ROOM) ?? null;
  const live = row !== null && !isUncertain(row);
  const teamsView = useRoomView<HiveTeamsView>(HIVE_ROOM, "teams", undefined, live);
  const projectsView = useRoomView<HiveProjectsView>(HIVE_ROOM, "projects", undefined, live);
  const crewView = useRoomView<HiveCrewView>(HIVE_ROOM, "crew", undefined, live);
  const [team, setTeam] = useState<string | null>(null);
  const [open, setOpen] = useState<HiveProject | null>(null);
  const [drawer, setDrawer] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const id = useId();

  const teams: HiveTeam[] = teamsView.data?.data?.teams ?? [];
  const projects: HiveProject[] = projectsView.data?.data?.projects ?? [];
  const crew: HiveBee[] = crewView.data?.data?.crew ?? [];
  const beeOf = (bee: string) => crew.find((b) => b.bee === bee);
  const shown = team ? projects.filter((p) => p.team === team) : projects;
  const needs = row ? currentNeeds(row).length : 0;
  const updated = projectsView.data?.data?.generated_at ?? teamsView.data?.data?.generated_at ?? null;

  const header = (
    <header className="mb-[var(--pw-spacing-xl)] flex flex-wrap items-center gap-[var(--pw-spacing-md)]">
      <img
        src={`${import.meta.env.BASE_URL}assets/crew/256/hive-works-doorway.webp`}
        alt=""
        aria-hidden="true"
        className="h-[96px] w-auto shrink-0"
      />
      <div className="min-w-0 flex-1">
        <h1 className="text-[length:var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]" style={SERIF}>
          Projects
        </h1>
        <p className={SMALL}>
          {live && updated ? `From Hive Works · updated ${relativeTime(updated, now)}` : "From Hive Works"}
        </p>
      </div>
    </header>
  );

  if (rooms.isPending) {
    return (
      <main id="main-content" aria-label="Projects" className="relative z-10 max-w-[1100px] p-[var(--pw-spacing-xl)] md:p-[var(--pw-spacing-3xl)]">
        {header}
        <p className={SMALL}>Finding Hive Works…</p>
      </main>
    );
  }

  if (!row || !live) {
    return (
      <main id="main-content" aria-label="Projects" className="relative z-10 max-w-[1100px] p-[var(--pw-spacing-xl)] md:p-[var(--pw-spacing-3xl)]">
        {header}
        <div className={`${CARD} flex-row items-center`}>
          <SpotArt name="unreachable" size={64} />
          <p className={`${SMALL} min-w-0 flex-1`}>
            {!row
              ? "Projects come from the Hive Works room, and it isn’t connected to this World yet."
              : "Worlds can’t reach Hive Works right now, so nothing here is current. It will fill in when Hive Works answers again."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" aria-label="Projects" className="relative z-10 max-w-[1100px] p-[var(--pw-spacing-xl)] md:p-[var(--pw-spacing-3xl)]">
      {header}

      {needs > 0 && (
        <div className="mb-[var(--pw-spacing-xl)] flex flex-wrap items-center gap-[var(--pw-spacing-md)] rounded-[var(--pw-radius-md)] border border-[var(--pw-accent-warm)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-md)]">
          <SpotArt name="approve" size={48} />
          <p className="min-w-[12rem] flex-1 text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)]">
            {`Hive Works needs you for ${plural(needs, "thing", "things")}.`}
          </p>
          <WorldButton
            variant="primary"
            onPress={() => {
              openerRef.current = document.activeElement as HTMLElement | null;
              setDrawer(true);
            }}
          >
            Look inside Hive Works
          </WorldButton>
        </div>
      )}

      {open ? (
        <ProjectTickets row={row} project={open} onBack={() => setOpen(null)} />
      ) : (
        <>
          <section aria-labelledby={`${id}-teams`} className="mb-[var(--pw-spacing-2xl)]">
            <h2 id={`${id}-teams`} className={`${EYEBROW} mb-[var(--pw-spacing-sm)]`}>
              Teams
            </h2>
            {teamsView.isError ? (
              <p className={SMALL}>Couldn’t load the teams just now.</p>
            ) : (
              <div role="group" aria-label="Show projects for" className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
                <button type="button" aria-pressed={team === null} onClick={() => setTeam(null)} className={team === null ? CHIP_ON : CHIP_OFF}>
                  All teams
                </button>
                {teams.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={team === t.id}
                    onClick={() => setTeam(team === t.id ? null : t.id)}
                    className={team === t.id ? CHIP_ON : CHIP_OFF}
                  >
                    <BeeFace row={row} bee={beeOf(t.bee)} file={t.bee_face_file} size={28} />
                    <span>{t.name}</span>
                    <span className="text-[var(--pw-text-muted)]">
                      {t.asks_you > 0 ? `· ${t.asks_you} for you` : `· ${t.open} open`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby={`${id}-projects`} className="mb-[var(--pw-spacing-2xl)]">
            <h2 id={`${id}-projects`} className={`${EYEBROW} mb-[var(--pw-spacing-sm)]`}>
              {`Projects · ${shown.length}`}
            </h2>
            {projectsView.isPending ? (
              <p className={SMALL}>Finding the projects…</p>
            ) : projectsView.isError ? (
              <p className={SMALL}>Couldn’t load the projects just now. Nothing here is current.</p>
            ) : shown.length === 0 ? (
              <p className={SMALL}>No projects here yet.</p>
            ) : (
              <ul className="grid gap-[var(--pw-spacing-md)] md:grid-cols-2">
                {shown.map((p) => {
                  const t = teams.find((x) => x.id === p.team);
                  return (
                    <li key={p.id} className={CARD}>
                      <span className="flex items-center gap-[var(--pw-spacing-sm)]">
                        <BeeFace row={row} bee={t ? beeOf(t.bee) : undefined} file={t?.bee_face_file} size={32} />
                        <span className={MICRO}>{t?.name ?? p.team}</span>
                      </span>
                      <h3 className="text-[length:var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-primary)]" style={SERIF}>
                        {p.name}
                      </h3>
                      <p className={SMALL}>{projectWords(p)}</p>
                      <ShippedLine p={p} now={now} />
                      <div className="mt-auto flex flex-wrap gap-[var(--pw-spacing-sm)] pt-[var(--pw-spacing-xs)]">
                        <WorldButton variant="secondary" onPress={() => setOpen(p)} aria-label={`See the tickets for ${p.name}`}>
                          See the tickets
                        </WorldButton>
                        <OpenOnSite row={row} link={p.link} label="Open in Hive Works" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {crew.length > 0 && (
            <section aria-labelledby={`${id}-crew`}>
              <h2 id={`${id}-crew`} className={`${EYEBROW} mb-[var(--pw-spacing-sm)]`}>
                The bees
              </h2>
              <ul className="grid gap-[var(--pw-spacing-md)] sm:grid-cols-2 lg:grid-cols-3">
                {crew.map((b) => (
                  <li key={b.bee} className={`${CARD} flex-row items-start`}>
                    <BeeFace row={row} bee={b} size={64} />
                    <span className="flex min-w-0 flex-col gap-[var(--pw-spacing-xs)]">
                      <span className="text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)]">{b.name}</span>
                      <span className={MICRO}>{b.job}</span>
                      {b.line ? <span className={`${SMALL} italic`}>{`“${b.line}”`}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {drawer && (
        <RoomDrawer
          row={row}
          keeper={row.keeper ?? null}
          onClose={() => {
            setDrawer(false);
            openerRef.current?.focus();
          }}
        />
      )}
    </main>
  );
}
