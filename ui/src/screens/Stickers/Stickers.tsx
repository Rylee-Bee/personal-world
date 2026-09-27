/**
 * The Sticker Album (#stickers; owner ask, 2026-09-27). Worlds' pages first
 * (First steps, Rooms, Library, Memory, The ship, Constellation), then one
 * page per app in that app's look. Paper sheets; stickers sit a little
 * tilted wherever the person stuck them (drag to move, or the buttons on a
 * sticker's back, so it works without a mouse). Counts read "12 of 18 found
 * · and some secrets". Riddles are striped blanks; secrets are never shown
 * until found. Nothing counts days, nothing can be lost.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { useStickerPlace, useStickers } from "../../data/hooks";
import type { AlbumPage, AlbumSticker } from "../../data/api";
import { Sticker } from "../../components/stickers/Sticker";
import { stickerArt } from "../../components/stickers/art";
import { tiltFor } from "../../components/stickers/tilt";
import { isSeen, markSeen } from "../../components/stickers/landing";
import { relativeTime } from "../../components/rooms/format";
import { useMinuteClock } from "../../components/rooms/useRootAttribute";
import { Loading } from "../../components/Loading";
import { SolMoment } from "../../components/SolMoment";
import { Icon } from "../../components/Icon";
import { WorldButton } from "../../components/WorldButton";

const SERIF = { fontFamily: "var(--pw-typography-font_serif, inherit)" } as const;
const SMALL = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const CHIP_ON =
  "inline-flex min-h-[var(--pw-targets-minimum)] items-center rounded-full border border-[var(--pw-accent-warm)] bg-[var(--pw-accent-warm_soft)] px-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-text-primary)]";
const CHIP_OFF =
  "inline-flex min-h-[var(--pw-targets-minimum)] items-center rounded-full border border-[var(--pw-border-subtle)] px-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const CELL = 136; // px per sticker slot on the sheet

/** One tab of the album: a Worlds section, or a whole app page. */
interface Tab {
  key: string;
  label: string;
  page: AlbumPage;
  stickers: AlbumSticker[];
}

function tabsOf(pages: AlbumPage[]): Tab[] {
  const out: Tab[] = [];
  for (const p of pages) {
    if (p.app === "worlds") {
      const sections = [...new Set(p.stickers.map((s) => s.section || "Worlds"))];
      for (const sec of sections) {
        out.push({ key: `worlds:${sec}`, label: sec, page: p, stickers: p.stickers.filter((s) => (s.section || "Worlds") === sec) });
      }
    } else {
      out.push({ key: p.app, label: p.title, page: p, stickers: p.stickers });
    }
  }
  return out;
}

const keyOf = (app: string, s: AlbumSticker) => `${app}:${s.id}`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function Back({
  s,
  now,
  onMove,
}: {
  s: AlbumSticker;
  now: number;
  onMove: (dx: number, dy: number, dr: number) => void;
}) {
  const name = s.name ?? (s.kind === "secret" ? "A secret" : "A riddle");
  return (
    <div className="flex flex-col gap-[var(--pw-spacing-xs)]">
      {!s.found && s.kind === "riddle" ? (
        <>
          <p className="text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.12em] text-[var(--pw-accent-warm)]">A riddle</p>
          <p className="text-[length:var(--pw-typography-size_lead)] italic text-[var(--pw-text-primary)]" style={SERIF}>{`“${s.riddle ?? ""}”`}</p>
          <p className={SMALL}>Solve it by doing it.</p>
        </>
      ) : (
        <>
          <p className="text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.12em] text-[var(--pw-accent-warm)]">
            {s.found ? `Found · ${s.shine === "foil" ? "gold foil" : s.shine}${s.kind === "secret" ? " · secret" : ""}` : "Not yet"}
          </p>
          <h3 className="text-[length:var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-primary)]" style={SERIF}>{name}</h3>
          {s.kind === "secret" && s.found ? (
            <p className={SMALL}>You found a secret. What it was for stays between you and the album.</p>
          ) : s.earn ? (
            <p className="text-[var(--pw-text-primary)]">{s.earn}</p>
          ) : null}
          {s.found ? (
            <p className={SMALL}>
              {[s.found_at ? `Found ${relativeTime(s.found_at, now)}` : null, s.context || null].filter(Boolean).join(", ")}
            </p>
          ) : null}
        </>
      )}
      {s.found ? (
        <div role="group" aria-label={`Move ${name} on the page`} className="mt-[var(--pw-spacing-sm)] flex flex-wrap gap-[var(--pw-spacing-xs)]">
          {(
            [
              ["Move left", -0.06, 0, 0],
              ["Move right", 0.06, 0, 0],
              ["Move up", 0, -0.06, 0],
              ["Move down", 0, 0.06, 0],
              ["Tilt left", 0, 0, -6],
              ["Tilt right", 0, 0, 6],
            ] as [string, number, number, number][]
          ).map(([label, dx, dy, dr]) => (
            <WorldButton key={label} variant="secondary" onPress={() => onMove(dx, dy, dr)}>
              {label}
            </WorldButton>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type Spot = { x: number; y: number; r: number };

function Sheet({
  tab,
  onTurnOver,
  turned,
  local,
  setLocal,
  save,
}: {
  tab: Tab;
  onTurnOver: (s: AlbumSticker, at: Spot) => void;
  turned: string | null;
  /** Where stickers sit right now on this device (drag or buttons), before the server confirms. */
  local: Record<string, Spot>;
  setLocal: (f: (prev: Record<string, Spot>) => Record<string, Spot>) => void;
  save: (s: AlbumSticker, at: Spot) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const drag = useRef<{ id: string; startX: number; startY: number; moved: boolean } | null>(null);
  const app = tab.page.app;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  const cols = Math.max(2, Math.floor((width || 600) / CELL));
  const rows = Math.max(1, Math.ceil(tab.stickers.length / cols));
  const height = rows * (CELL + 48) + 16;

  const posOf = (s: AlbumSticker, i: number) => {
    const l = local[s.id];
    if (l) return l;
    if (s.placed) return s.placed;
    return { x: ((i % cols) + 0.5) / cols, y: (Math.floor(i / cols) + 0.5) / rows, r: tiltFor(s.id) };
  };

  return (
    <div
      ref={ref}
      className={`sticker-sheet sticker-board sticker-look-${tab.page.look ?? "plain"}`}
      style={{ height }}
      role="list"
      aria-label={tab.label}
      data-cols={cols}
    >
      {tab.stickers.map((s, i) => {
        const p = posOf(s, i);
        const k = keyOf(app, s);
        const isNew = s.found && !isSeen(k);
        const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
          const el = ref.current;
          if (!s.found || e.button !== 0 || !el) return;
          const startX = e.clientX;
          const startY = e.clientY;
          drag.current = { id: s.id, startX, startY, moved: false };
          const spot = (x: number, y: number): Spot => {
            const box = el.getBoundingClientRect();
            return { x: clamp((x - box.left) / box.width, 0.04, 0.96), y: clamp((y - box.top) / box.height, 0.06, 0.94), r: p.r };
          };
          const onMove = (ev: PointerEvent) => {
            const d = drag.current;
            if (!d) return;
            if (!d.moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
            d.moved = true;
            const at = spot(ev.clientX, ev.clientY);
            setLocal((prev) => ({ ...prev, [s.id]: at }));
          };
          const onUp = (ev: PointerEvent) => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            const d = drag.current;
            if (d?.moved) save(s, spot(ev.clientX, ev.clientY));
            // Leave `moved` set until the click that follows is swallowed.
            setTimeout(() => {
              drag.current = null;
            }, 0);
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        };
        return (
          <div
            key={s.id}
            role="listitem"
            className={`sticker-slot ${turned === s.id ? "sticker-slot-turned" : ""}`}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, touchAction: s.found ? "none" : undefined }}
            onPointerDown={onPointerDown}
            onDragStart={(e) => e.preventDefault()}
            onClickCapture={(e) => {
              // A drag isn't a press.
              if (drag.current?.moved) e.stopPropagation();
            }}
          >
            {isNew ? <span className="sticker-new">New</span> : null}
            <Sticker
              id={s.id}
              name={s.name ?? (s.kind === "secret" ? "A secret" : "A riddle")}
              kind={s.kind}
              shine={s.shine}
              shape={s.shape}
              found={s.found}
              art={s.found || s.kind === "open" ? stickerArt(app, s) : null}
              tilt={p.r}
              onTurnOver={() => onTurnOver(s, p)}
            />
          </div>
        );
      })}
    </div>
  );
}

export function Stickers() {
  const album = useStickers();
  const place = useStickerPlace();
  const now = useMinuteClock();
  const pages = useMemo(() => album.data?.data?.pages ?? [], [album.data]);
  const tabs = useMemo(() => tabsOf(pages), [pages]);
  const [tabKey, setTabKey] = useState<string | null>(null);
  const tab = tabs.find((t) => t.key === tabKey) ?? tabs[0];
  const [turned, setTurned] = useState<{ s: AlbumSticker; at: Spot } | null>(null);
  const [local, setLocal] = useState<Record<string, Spot>>({});
  const id = useId();

  // What this page has shown stops being "new" once you've seen it.
  useEffect(() => {
    if (!tab) return;
    const keys = tab.stickers.filter((s) => s.found).map((s) => keyOf(tab.page.app, s));
    return () => markSeen(keys);
  }, [tab]);

  const count = tab
    ? `${tab.stickers.filter((s) => s.found).length} of ${tab.stickers.length} found${tab.page.secrets_remain ? " · and some secrets" : ""}`
    : "";

  function save(s: AlbumSticker, at: Spot) {
    if (!tab) return;
    setLocal((prev) => ({ ...prev, [s.id]: at }));
    place.mutate({ app: tab.page.app, sticker: s.id, ...at });
  }

  function move(dx: number, dy: number, dr: number) {
    if (!turned) return;
    const base = local[turned.s.id] ?? turned.at;
    const next = { x: clamp(base.x + dx, 0.04, 0.96), y: clamp(base.y + dy, 0.06, 0.94), r: clamp(base.r + dr, -30, 30) };
    save(turned.s, next);
    setTurned({ s: turned.s, at: next });
  }

  return (
    <main id="main-content" aria-label="Sticker album" className="relative z-10 max-w-[1100px] p-[var(--pw-spacing-xl)] md:p-[var(--pw-spacing-3xl)]">
      <header className="mb-[var(--pw-spacing-xl)] flex flex-wrap items-center gap-[var(--pw-spacing-lg)]">
        <SolMoment mood="cheer" size={80} />
        <div className="min-w-[14rem] flex-1">
          <h1 className="text-[length:var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]" style={SERIF}>
            Sticker album
          </h1>
          <p className="max-w-[62ch] text-[var(--pw-text-secondary)]">
            Stickers for trying things, learning things and finding things. Found is forever; nothing here counts days.
            Stick them anywhere you like.
          </p>
          {album.data?.data ? <p className={SMALL}>{`${album.data.data.total_found} found in all`}</p> : null}
        </div>
      </header>

      {album.isPending ? (
        <Loading words="Opening your album…" cards={6} minWidth={120} />
      ) : album.isError ? (
        <p className={SMALL}>Couldn’t open your album just now. Everything you’ve found is still kept.</p>
      ) : !tab ? (
        <p className={SMALL}>Your album is empty for now. Stickers arrive as you try things.</p>
      ) : (
        <div className="flex flex-col gap-[var(--pw-spacing-lg)]">
          <div className="flex flex-wrap items-center justify-between gap-[var(--pw-spacing-md)]">
            <div role="group" aria-label="Album pages" className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={t.key === tab.key}
                  onClick={() => {
                    setTabKey(t.key);
                    setTurned(null);
                    setLocal({});
                  }}
                  className={t.key === tab.key ? CHIP_ON : CHIP_OFF}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="font-mono text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]" aria-live="polite">
              {count}
            </p>
          </div>

          <Sheet
            key={tab.key}
            tab={tab}
            onTurnOver={(s, at) => setTurned({ s, at })}
            turned={turned?.s.id ?? null}
            local={local}
            setLocal={setLocal}
            save={save}
          />

          <section aria-labelledby={`${id}-b`} className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]">
            <h2 id={`${id}-b`} className="sr-only">The back of the sticker</h2>
            <div role="status" aria-live="polite">
              {turned ? (
                <Back s={turned.s} now={now} onMove={move} />
              ) : (
                <p className={SMALL}>
                  <Icon name="info" size={16} className="mr-[var(--pw-spacing-xs)] inline" />
                  Tap a sticker to turn it over: how you earn it, its riddle, or where you found it. Drag a found sticker to
                  move it.
                </p>
              )}
            </div>
          </section>

          {(album.data?.data?.unavailable ?? []).map((u) => (
            <p key={u.app} className={SMALL}>{`Couldn’t read ${u.app}’s stickers just now.${u.error ? ` ${u.error}` : ""}`}</p>
          ))}
        </div>
      )}
    </main>
  );
}
