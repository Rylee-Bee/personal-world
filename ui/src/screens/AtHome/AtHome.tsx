/**
 * At home (owner ask, 2026-09-27): what's on the shelves at home — the
 * household's shows, movies and music, read by the Engine room (the keys
 * stay inside the homelab). A calm place to browse: search, filter by
 * genre, and "new on the shelf". It is the household's library, so it
 * never calls itself "your interests"; personal taste comes separately.
 *
 * No posters are served yet, so each title is a Worlds title card. A kind
 * that can't be read says so in words, and nothing else pretends.
 */
import { reportSticker } from "../../components/stickers/report";
import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { useRoomView, useRooms } from "../../data/hooks";
import { isUncertain } from "../../components/rooms/groupRooms";
import { relativeTime } from "../../components/rooms/format";
import { useMinuteClock } from "../../components/rooms/useRootAttribute";
import { SolMoment } from "../../components/SolMoment";
import { Icon } from "../../components/Icon";
import { WorldButton } from "../../components/WorldButton";
import { Loading } from "../../components/Loading";

const ROOM = "engine-room";
const PAGE = 48;
const NEW_ROW = 6;

type Kind = "shows" | "movies" | "music";
const KINDS: { id: Kind; label: string; one: string; many: string }[] = [
  { id: "shows", label: "Shows", one: "show", many: "shows" },
  { id: "movies", label: "Movies", one: "movie", many: "movies" },
  { id: "music", label: "Music", one: "artist", many: "artists" },
];

interface KindCount { ok: boolean; count?: number; error?: string }
interface MediaSummary { generated_at?: string; scope?: string; kinds?: Partial<Record<Kind, KindCount>> }
interface Show { title: string; year?: number; status?: string; network?: string; genres?: string[]; monitored?: boolean; added?: string; episodes_have?: number; episodes_total?: number }
interface Movie { title: string; year?: number; genres?: string[]; have?: boolean; studio?: string; added?: string; monitored?: boolean }
interface Artist { artist: string; genres?: string[]; added?: string; monitored?: boolean; albums?: number }
type Entry = Show | Movie | Artist;
interface KindList { ok: boolean; count?: number; error?: string; items?: Entry[] }

const SERIF = { fontFamily: "var(--pw-typography-font_serif, inherit)" } as const;
const SMALL = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const EYEBROW =
  "text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.12em] text-[var(--pw-accent-warm)]";
const CHIP_ON =
  "inline-flex min-h-[var(--pw-targets-minimum)] items-center rounded-full border border-[var(--pw-accent-warm)] bg-[var(--pw-accent-warm_soft)] px-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-text-primary)]";
const CHIP_OFF =
  "inline-flex min-h-[var(--pw-targets-minimum)] items-center rounded-full border border-[var(--pw-border-subtle)] px-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const FIELD =
  "min-h-[var(--pw-targets-minimum)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] px-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]";

const nameOf = (e: Entry) => ("artist" in e ? e.artist : e.title);
const addedOf = (e: Entry) => (e.added ? Date.parse(e.added) || 0 : 0);

function hue(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/** One line about a title, in words. */
function detail(kind: Kind, e: Entry): string {
  if (kind === "shows") {
    const s = e as Show;
    const eps =
      typeof s.episodes_have === "number" && typeof s.episodes_total === "number" && s.episodes_total > 0
        ? s.episodes_have >= s.episodes_total
          ? `all ${s.episodes_total} episodes`
          : `${s.episodes_have} of ${s.episodes_total} episodes`
        : null;
    const status = s.status === "continuing" ? "still airing" : s.status === "ended" ? "ended" : s.status === "upcoming" ? "coming soon" : null;
    return [s.network, eps, status].filter(Boolean).join(" · ");
  }
  if (kind === "movies") {
    const m = e as Movie;
    return [m.have === false ? (m.monitored ? "Wanted, not here yet" : "Not here") : "On the shelf", m.studio].filter(Boolean).join(" · ");
  }
  const a = e as Artist;
  return typeof a.albums === "number" ? `${a.albums} ${a.albums === 1 ? "album" : "albums"}` : "";
}

function TitleCard({ kind, e, now }: { kind: Kind; e: Entry; now: number }) {
  const name = nameOf(e);
  const year = "year" in e && e.year ? String(e.year) : null;
  const genres = (e.genres ?? []).slice(0, 3).join(", ");
  const missing = kind === "movies" && (e as Movie).have === false;
  return (
    <li
      className={`home-card flex min-w-0 flex-col gap-[var(--pw-spacing-xs)] ${missing ? "opacity-80" : ""}`}
      style={{ "--home-hue": hue(name) } as CSSProperties}
    >
      <span className="home-card-title" style={SERIF}>
        {name}
      </span>
      <span className={SMALL}>{[year, genres].filter(Boolean).join(" · ")}</span>
      {detail(kind, e) ? <span className={SMALL}>{detail(kind, e)}</span> : null}
      {e.added ? <span className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">{`Added ${relativeTime(e.added, now)}`}</span> : null}
    </li>
  );
}

function Shelf({ kind, summary }: { kind: Kind; summary: KindCount | undefined }) {
  const meta = KINDS.find((k) => k.id === kind)!;
  const list = useRoomView<KindList>(ROOM, "media", kind, summary?.ok !== false);
  const now = useMinuteClock();
  const [find, setFind] = useState("");
  const [genre, setGenre] = useState("");
  const [order, setOrder] = useState<"new" | "az">("az");
  const [limit, setLimit] = useState(PAGE);
  const id = useId();
  const data = list.data?.data;
  const items = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data]);
  const genres = useMemo(() => [...new Set(items.flatMap((e) => e.genres ?? []))].sort((a, b) => a.localeCompare(b)), [items]);
  const newest = useMemo(() => [...items].filter((e) => e.added).sort((a, b) => addedOf(b) - addedOf(a)).slice(0, NEW_ROW), [items]);
  const words = find.trim().toLowerCase();
  const shown = items
    .filter((e) => (!words || nameOf(e).toLowerCase().includes(words)) && (!genre || (e.genres ?? []).includes(genre)))
    .sort((a, b) => (order === "new" ? addedOf(b) - addedOf(a) : nameOf(a).localeCompare(nameOf(b))));

  if (summary && summary.ok === false) {
    return (
      <div className="flex items-center gap-[var(--pw-spacing-md)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] p-[var(--pw-spacing-lg)]">
        <SolMoment mood="sleeping" size={56} />
        <p className="text-[var(--pw-text-secondary)]">{`Couldn’t read the ${meta.many} just now.${summary.error ? ` ${summary.error}` : ""} Nothing here is current until it answers.`}</p>
      </div>
    );
  }
  if (list.isPending) return <Loading words={`Finding the ${meta.many}…`} cards={8} />;
  if (list.isError || data?.ok === false) {
    return <p className={SMALL}>{`Couldn’t read the ${meta.many} just now.${data?.error ? ` ${data.error}` : ""}`}</p>;
  }
  if (items.length === 0) return <p className={SMALL}>{`No ${meta.many} on the shelf yet.`}</p>;

  return (
    <div className="flex flex-col gap-[var(--pw-spacing-xl)]">
      {newest.length > 0 && (
        <section aria-labelledby={`${id}-new`} className="flex flex-col gap-[var(--pw-spacing-sm)]">
          <h3 id={`${id}-new`} className={EYEBROW}>New on the shelf</h3>
          <ul className="home-grid">{newest.map((e) => <TitleCard key={`n-${nameOf(e)}`} kind={kind} e={e} now={now} />)}</ul>
        </section>
      )}

      <section aria-labelledby={`${id}-all`} className="flex flex-col gap-[var(--pw-spacing-md)]">
        <h3 id={`${id}-all`} className={EYEBROW}>{`All ${meta.many} · ${items.length}`}</h3>
        <div className="flex flex-wrap items-end gap-[var(--pw-spacing-md)]">
          <label className="flex min-w-0 flex-1 basis-[14rem] flex-col gap-[var(--pw-spacing-xs)]">
            <span className={SMALL}>{`Find a ${meta.one}`}</span>
            <input type="search" value={find} onChange={(e) => { setFind(e.target.value); setLimit(PAGE); }} className={FIELD} />
          </label>
          {genres.length > 0 && (
            <label className="flex flex-col gap-[var(--pw-spacing-xs)]">
              <span className={SMALL}>Genre</span>
              <select value={genre} onChange={(e) => { setGenre(e.target.value); setLimit(PAGE); }} className={FIELD}>
                <option value="">Every genre</option>
                {genres.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-[var(--pw-spacing-xs)]">
            <span className={SMALL}>Order</span>
            <select value={order} onChange={(e) => setOrder(e.target.value as "new" | "az")} className={FIELD}>
              <option value="az">A to Z</option>
              <option value="new">Newest on the shelf</option>
            </select>
          </label>
        </div>
        <p className={SMALL} role="status">
          {words || genre ? `${shown.length} of ${items.length} ${meta.many}` : `${items.length} ${items.length === 1 ? meta.one : meta.many}`}
        </p>
        {shown.length === 0 ? (
          <p className={SMALL}>Nothing matches. Try fewer letters, or every genre.</p>
        ) : (
          <>
            <ul className="home-grid">{shown.slice(0, limit).map((e, i) => <TitleCard key={`${nameOf(e)}-${i}`} kind={kind} e={e} now={now} />)}</ul>
            {shown.length > limit && (
              <WorldButton variant="secondary" className="self-start" onPress={() => setLimit(limit + PAGE)}>
                {`Show ${Math.min(PAGE, shown.length - limit)} more (${shown.length - limit} left)`}
              </WorldButton>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export function AtHome({ onBack, backLabel = "Back to Interests" }: { onBack: () => void; backLabel?: string }) {
  useEffect(() => {
    void reportSticker("homebody");
  }, []);
  const rooms = useRooms();
  const row = (rooms.data?.data ?? []).find((r) => r.id === ROOM) ?? null;
  const live = row !== null && !isUncertain(row);
  const summary = useRoomView<MediaSummary>(ROOM, "media", undefined, live);
  const now = useMinuteClock();
  const [kind, setKind] = useState<Kind>("shows");
  const id = useId();
  const kinds = summary.data?.data?.kinds ?? {};
  const checked = summary.data?.data?.generated_at;

  let body: React.ReactNode;
  if (rooms.isPending) body = <Loading words="Finding the Engine room…" />;
  else if (!row || !live || summary.isError) {
    body = (
      <div className="flex items-center gap-[var(--pw-spacing-md)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] p-[var(--pw-spacing-lg)]">
        <SolMoment mood="sleeping" size={56} />
        <p className="text-[var(--pw-text-secondary)]">
          {!row
            ? "The shelves at home come from the Engine room, and it isn’t connected to this World yet."
            : "Worlds can’t reach the Engine room right now, so nothing here is current. It will fill in when it answers."}
        </p>
      </div>
    );
  } else if (summary.isPending) body = <Loading words="Looking at the shelves…" cards={8} />;
  else {
    body = (
      <>
        <div role="group" aria-label="Show" className="mb-[var(--pw-spacing-xl)] flex flex-wrap gap-[var(--pw-spacing-sm)]">
          {KINDS.map((k) => {
            const c = kinds[k.id];
            const label = c?.ok === false ? `${k.label} · can’t read` : typeof c?.count === "number" ? `${k.label} · ${c.count}` : k.label;
            return (
              <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)} className={kind === k.id ? CHIP_ON : CHIP_OFF}>
                {label}
              </button>
            );
          })}
        </div>
        <section aria-labelledby={`${id}-k`}>
          <h2 id={`${id}-k`} className="sr-only">{KINDS.find((k) => k.id === kind)!.label}</h2>
          <Shelf key={kind} kind={kind} summary={kinds[kind]} />
        </section>
      </>
    );
  }

  return (
    <main id="main-content" aria-label="At home" className="relative z-10 max-w-[1180px] p-[var(--pw-spacing-xl)] md:p-[var(--pw-spacing-3xl)]">
      <WorldButton variant="ghost" onPress={onBack} className="mb-[var(--pw-spacing-md)]">
        <Icon name="back" size={16} className="mr-[var(--pw-spacing-xs)]" />
        {backLabel}
      </WorldButton>
      <header className="mb-[var(--pw-spacing-xl)] flex flex-wrap items-center gap-[var(--pw-spacing-lg)]">
        <SolMoment mood="rest" size={80} />
        <div className="min-w-[14rem] flex-1">
          <h1 className="text-[length:var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]" style={SERIF}>
            At home
          </h1>
          <p className="max-w-[62ch] text-[var(--pw-text-secondary)]">
            What’s on the shelves at home: the household’s shows, movies and music, for everyone in the house.
          </p>
          {live && checked ? <p className={SMALL}>{`Checked ${relativeTime(checked, now)}`}</p> : null}
        </div>
      </header>
      {body}
    </main>
  );
}
