/**
 * The Library (owner, 2026-09-27): short books on how things work, for
 * technical and non-technical people alike. Worlds is the home of a
 * "library universe": every connected app lends its shelves, each under
 * its keeper's name and in its keeper's look (Play-Nice library/0).
 *
 * - Worlds' own books are bundled (worldsLibrary); a starship's reading
 *   room of storybooks, with painted covers (ART-REQUESTS §15).
 * - Rooms lend theirs through GET /api/library (useLibrary): Hive Works'
 *   handbook on honeycomb shelves, VEFR's storyteller's study. Refreshed
 *   when a room says it changed.
 * - A "drafts" shelf (new, not kept yet) is shown gently, apart, folded.
 * - An *italic* glossary word can be tapped to learn it (library 1.1.0).
 * - Two keepers' books are never merged, even on the same topic.
 * - A book opens with one press: the short line first, plain pages, the
 *   keeper's voice, words to know, and "Under the hood" folded away.
 * - A library that can't be read says so, with when it last was.
 *
 * A quiet page like Rough night: reached from Settings and the first-day
 * guide, never a nav landmark.
 */
import { reportSticker } from "../../components/stickers/report";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useLibrary, useRoomView, useRooms } from "../../data/hooks";
import { roomArtUrl } from "../../data/api";
import type { HiveCrewView, RoomRow } from "../../data/contract";
import type { LibraryDoc, LibraryPage } from "../../data/library";
import { roomItemUrl } from "../../components/rooms/format";
import { artName } from "../../components/rooms/choices";
import { Markdown } from "../../components/library/Markdown";
import { SolMoment } from "../../components/SolMoment";
import { Icon } from "../../components/Icon";
import { WorldButton } from "../../components/WorldButton";

type ShelfBook = LibraryDoc["books"][number];

/** Books opened on this device (for "Full shelf"). */
function noteBookOpened(key: string): Set<string> {
  const K = "pw-books-opened";
  let set = new Set<string>();
  try {
    set = new Set(JSON.parse(window.localStorage.getItem(K) ?? "[]") as string[]);
    set.add(key);
    window.localStorage.setItem(K, JSON.stringify([...set].slice(-400)));
  } catch {
    set.add(key);
  }
  return set;
}

const LOOKS = new Set(["scifi-storybook", "hive-corporate", "vefr"]);
/** A shelf of new books nobody has kept yet: shown gently, apart, folded. */
const DRAFTS = "drafts";
const BASE = import.meta.env.BASE_URL;

const SERIF = { fontFamily: "var(--pw-typography-font_serif, inherit)" } as const;
const SMALL = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const EYEBROW =
  "lib-eyebrow text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.12em] text-[var(--pw-accent-warm)]";
const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--pw-accent-primary)]";

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** A keeper's library, where it came from, and how it's doing. */
interface Wing {
  doc: LibraryDoc;
  /** The room that keeps it (null for Worlds' own books). */
  room: string | null;
  row: RoomRow | null;
  look: string;
  /** Faces for voice pages, by speaker name (Hive Works' bees). */
  faces: Record<string, string>;
}

/** A book's cover: Worlds' bundled art, or the keeper's picture through
 *  its room. Null draws a plain cover from the theme. */
function coverOf(wing: Wing, book: ShelfBook, size: 256 | 512 = 256): string | null {
  if (!wing.room) return `${BASE}assets/library/covers/${size}/${book.id}.webp`;
  const name = book.cover ? artName(`${book.cover}.webp`) : null;
  return name ? roomArtUrl(wing.room, name) : null;
}

function ShelfArt({ look }: { look: string }) {
  const [failed, setFailed] = useState(false);
  if (!LOOKS.has(look) || failed) return null;
  const src = `${BASE}assets/library/shelves/shelf-${look}`;
  return (
    <img
      src={`${src}.webp`}
      srcSet={`${src}-768.webp 768w, ${src}.webp 1536w`}
      sizes="(max-width: 768px) 100vw, 1100px"
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      className="lib-shelf-art"
    />
  );
}

function CoverImage({ src, className = "" }: { src: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return <img src={src} alt="" onError={() => setFailed(true)} className={className} />;
}

type Open = { wing: Wing; book: ShelfBook };

// ─── The shelves ──────────────────────────────────────────────────────

function Storybook({ book, index, cover, onOpen }: { book: ShelfBook; index: number; cover: string | null; onOpen: () => void }) {
  const id = useId();
  const [failed, setFailed] = useState(false);
  const painted = cover && !failed;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${book.title}`}
        aria-describedby={`${id}-s`}
        className={`group flex w-full flex-col gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-md)] text-left ${FOCUS}`}
      >
        <span className="lib-cover block" style={{ "--lib-hue": (200 + index * 23) % 360 } as CSSProperties} aria-hidden="true">
          {painted ? <img src={cover} alt="" onError={() => setFailed(true)} /> : <span className="absolute left-[18px] top-[14px] text-[13px] tracking-[0.3em] opacity-80">✦ ✦ ✦</span>}
          <span className="lib-cover-band block">
            <span className="block text-[13px] uppercase tracking-[0.14em] opacity-85">{`Book ${String(book.order ?? index + 1).padStart(2, "0")}`}</span>
            <span className="block text-[17px] font-semibold leading-snug" style={SERIF}>
              {book.title}
            </span>
          </span>
        </span>
        <span id={`${id}-s`} className={`lib-muted ${SMALL} leading-snug group-hover:text-[var(--pw-text-primary)]`}>
          {book.short}
        </span>
      </button>
    </li>
  );
}

function Binder({ book, wing, onOpen }: { book: ShelfBook; wing: Wing; onOpen: () => void }) {
  const cover = coverOf(wing, book);
  const id = useId();
  const voice = book.pages.find((p) => p.kind === "voice")?.voice;
  const face = voice ? wing.faces[voice.toLowerCase()] : undefined;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${book.title}`}
        aria-describedby={`${id}-s`}
        className={`lib-binder flex min-h-[var(--pw-targets-minimum)] w-full flex-col gap-[var(--pw-spacing-xs)] text-left ${FOCUS}`}
      >
        <CoverImage src={cover} className="float-right ml-[var(--pw-spacing-sm)] h-16 w-auto rounded-[3px]" />
        <span className="lib-title text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)]">{book.title}</span>
        <span id={`${id}-s`} className={`lib-muted ${SMALL}`}>{book.short}</span>
        {voice ? (
          <span className={`lib-muted ${SMALL} mt-[var(--pw-spacing-xs)] flex items-center gap-[var(--pw-spacing-xs)]`}>
            {face ? <img src={face} alt="" aria-hidden="true" className="h-7 w-7 rounded-full border border-[var(--pw-border-subtle)] object-cover" /> : null}
            {`By ${voice}`}
          </span>
        ) : null}
      </button>
    </li>
  );
}

function Tome({ book, cover, onOpen }: { book: ShelfBook; cover: string | null; onOpen: () => void }) {
  const id = useId();
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${book.title}`}
        aria-describedby={`${id}-s`}
        className={`lib-tome flex min-h-[var(--pw-targets-minimum)] w-full flex-col gap-[var(--pw-spacing-xs)] text-left ${FOCUS}`}
      >
        <CoverImage src={cover} className="float-right ml-[var(--pw-spacing-sm)] h-16 w-auto rounded-[3px]" />
        <span className="lib-title text-[length:var(--pw-typography-size_lead)] font-semibold" style={SERIF}>
          {book.title}
        </span>
        <span id={`${id}-s`} className={`lib-muted ${SMALL}`}>{book.short}</span>
      </button>
    </li>
  );
}

function PlainBook({ book, onOpen }: { book: ShelfBook; onOpen: () => void }) {
  const id = useId();
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${book.title}`}
        aria-describedby={`${id}-s`}
        className={`flex min-h-[var(--pw-targets-minimum)] w-full flex-col gap-[var(--pw-spacing-xs)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-md)] text-left ${FOCUS}`}
      >
        <span className="lib-title font-semibold text-[var(--pw-text-primary)]">{book.title}</span>
        <span id={`${id}-s`} className={`lib-muted ${SMALL}`}>{book.short}</span>
      </button>
    </li>
  );
}

function Shelf({ wing, shelf, books, onOpen }: { wing: Wing; shelf: LibraryDoc["shelves"][number]; books: ShelfBook[]; onOpen: (o: Open) => void }) {
  const art = shelf.cover && wing.room ? artName(`${shelf.cover}.webp`) : null;
  return (
    <>
      {shelf.blurb ? <p className={`lib-muted ${SMALL} mb-[var(--pw-spacing-md)]`}>{shelf.blurb}</p> : null}
      {art && wing.room ? <CoverImage src={roomArtUrl(wing.room, art)} className="mb-[var(--pw-spacing-md)] h-20 w-auto" /> : null}
      <ul className="lib-shelf-row">
        {books.map((book, i) => {
          const open = () => onOpen({ wing, book });
          if (wing.look === "scifi-storybook") return <Storybook key={book.id} book={book} index={i} cover={coverOf(wing, book)} onOpen={open} />;
          if (wing.look === "hive-corporate") return <Binder key={book.id} book={book} wing={wing} onOpen={open} />;
          if (wing.look === "vefr") return <Tome key={book.id} book={book} cover={coverOf(wing, book)} onOpen={open} />;
          return <PlainBook key={book.id} book={book} onOpen={open} />;
        })}
      </ul>
    </>
  );
}

function WingSection({ wing, onOpen }: { wing: Wing; onOpen: (o: Open) => void }) {
  const id = useId();
  const { doc, look } = wing;
  const books = [...doc.books].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const kept = doc.shelves.filter((s) => s.id !== DRAFTS);
  const drafts = doc.shelves.find((s) => s.id === DRAFTS);
  const draftBooks = drafts ? books.filter((b) => b.shelf === DRAFTS) : [];
  const keptCount = books.length - draftBooks.length;
  return (
    <section id={`wing-${doc.keeper.id}`} aria-labelledby={`${id}-k`} className={`lib-wing lib-look-${look} scroll-mt-[var(--pw-spacing-xl)]`}>
      <ShelfArt look={look} />
      <header className="mb-[var(--pw-spacing-lg)] flex flex-wrap items-baseline gap-x-[var(--pw-spacing-md)] gap-y-[var(--pw-spacing-xs)]">
        <h2 id={`${id}-k`} className="lib-keeper-name text-[length:var(--pw-typography-size_h2,var(--pw-typography-size_lead))] font-semibold text-[var(--pw-text-primary)]" style={SERIF}>
          {doc.keeper.id === "worlds" ? "Worlds’ own books" : `From ${doc.keeper.name}`}
        </h2>
        <p className={`lib-muted ${SMALL}`}>
          {[plural(keptCount, "book", "books"), draftBooks.length ? plural(draftBooks.length, "new draft", "new drafts") : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>
      {kept.map((shelf) => {
        const on = books.filter((b) => b.shelf === shelf.id);
        if (on.length === 0) return null;
        return (
          <div key={shelf.id} className="mb-[var(--pw-spacing-lg)] last:mb-0">
            <h3 className={`${EYEBROW} mb-[var(--pw-spacing-md)]`}>{`${shelf.name} · ${on.length}`}</h3>
            <Shelf wing={wing} shelf={shelf} books={on} onOpen={onOpen} />
          </div>
        );
      })}
      {drafts && draftBooks.length > 0 && (
        <details className="lib-drafts">
          <summary className={`flex min-h-[var(--pw-targets-minimum)] cursor-pointer flex-wrap items-center gap-x-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] ${FOCUS}`}>
            <Icon name="chevron-right" size={20} className="lib-drafts-arrow shrink-0 text-[var(--pw-accent-warm)]" />
            <span className="lib-title font-semibold text-[var(--pw-text-primary)]">{`${drafts.name} · ${draftBooks.length}`}</span>
            <span className={`lib-muted ${SMALL}`}>Not kept yet. No hurry: open these whenever you feel like it.</span>
          </summary>
          <div className="mt-[var(--pw-spacing-md)]">
            <Shelf wing={wing} shelf={drafts} books={draftBooks} onOpen={onOpen} />
          </div>
        </details>
      )}
    </section>
  );
}

// ─── One book ─────────────────────────────────────────────────────────

function Page({ page, wing, onBook }: { page: LibraryPage; wing: Wing; onBook: (id: string) => void }) {
  const resolveLink = (path: string) => (wing.row ? roomItemUrl(wing.row, path) : null);
  const body = (
    <Markdown text={page.text} onBook={onBook} resolveLink={resolveLink} glossary={wing.doc.glossary} keeper={wing.doc.keeper.name} />
  );
  if (page.kind === "plain") return <div className="lib-page text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)]">{body}</div>;
  if (page.kind === "voice") {
    const face = page.voice ? wing.faces[page.voice.toLowerCase()] : undefined;
    return (
      <section className="rounded-[var(--pw-radius-md)] border-l-4 border-[var(--pw-accent-warm)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-lg)]">
        <h3 className={`${EYEBROW} mb-[var(--pw-spacing-sm)] flex items-center gap-[var(--pw-spacing-sm)]`}>
          {face ? <img src={face} alt="" aria-hidden="true" className="h-10 w-10 rounded-full border border-[var(--pw-border-subtle)] object-cover" /> : null}
          {`In ${page.voice ?? wing.doc.keeper.name}’s words`}
        </h3>
        <div className="lib-page italic text-[var(--pw-text-primary)]">{body}</div>
      </section>
    );
  }
  if (page.kind === "words") {
    return (
      <section className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]">
        <h3 className={`${EYEBROW} mb-[var(--pw-spacing-sm)]`}>Words to know</h3>
        <div className="lib-page text-[var(--pw-text-secondary)]">{body}</div>
      </section>
    );
  }
  return (
    <details className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-md)]">
      <summary className={`flex min-h-[var(--pw-targets-minimum)] cursor-pointer items-center gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] font-semibold text-[var(--pw-text-primary)] ${FOCUS}`}>
        <Icon name="code" size={20} />
        Under the hood
        <span className={`${SMALL} font-normal`}>files and code, for the curious</span>
      </summary>
      <div className="lib-page mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">{body}</div>
    </details>
  );
}

function Reader({ open, onBack, onOpen }: { open: Open; onBack: () => void; onOpen: (o: Open) => void }) {
  const { wing, book } = open;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), [book.id]);
  const shelf = wing.doc.shelves.find((s) => s.id === book.shelf);
  const same = wing.doc.books.filter((b) => b.shelf === book.shelf).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const at = same.findIndex((b) => b.id === book.id);
  const prev = at > 0 ? same[at - 1] : null;
  const next = at >= 0 && at < same.length - 1 ? same[at + 1] : null;
  const onBook = (id: string) => {
    const b = wing.doc.books.find((x) => x.id === id);
    if (b) onOpen({ wing, book: b });
  };
  const site = wing.row && book.link ? roomItemUrl(wing.row, book.link) : null;
  // Plain and voice pages in their order; words, then the folded technical pages, last.
  // A "## Colophon" page is the very last thing in the book.
  const isColophon = (p: LibraryPage) => /^##\s+colophon\b/i.test(p.text);
  const pages = [
    ...book.pages.filter((p) => (p.kind === "plain" || p.kind === "voice") && !isColophon(p)),
    ...book.pages.filter((p) => p.kind === "words"),
    ...book.pages.filter((p) => p.kind === "technical"),
  ];
  const colophon = book.pages.find(isColophon);
  const id = useId();
  const endRef = useRef<HTMLDivElement>(null);
  const colophonRef = useRef<HTMLDivElement>(null);
  const worldsBook = wing.room === null;

  // Stickers (Worlds' own books only): opening a book, reading a whole
  // shelf, reaching the end, and the colophon.
  useEffect(() => {
    if (!worldsBook) return;
    void reportSticker("bookworm");
    const opened = noteBookOpened(`${wing.doc.keeper.id}:${book.shelf}:${book.id}`);
    if (same.length > 0 && same.every((b) => opened.has(`${wing.doc.keeper.id}:${b.shelf}:${b.id}`))) {
      void reportSticker("shelf-complete", shelf?.name);
    }
  }, [book.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!worldsBook || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        if (e.target === endRef.current) void reportSticker("cover-to-cover", book.title);
        if (e.target === colophonRef.current) void reportSticker("behind-curtain");
      }
    });
    if (endRef.current) io.observe(endRef.current);
    if (colophonRef.current) io.observe(colophonRef.current);
    return () => io.disconnect();
  }, [book.id, worldsBook, book.title]);

  return (
    <article aria-labelledby={`${id}-t`} className="lib-reader flex flex-col gap-[var(--pw-spacing-lg)]">
      <WorldButton variant="ghost" onPress={onBack} className="self-start">
        <Icon name="back" size={16} className="mr-[var(--pw-spacing-xs)]" />
        Back to the shelves
      </WorldButton>
      <header className="flex flex-col gap-[var(--pw-spacing-xs)]">
        <CoverImage src={coverOf(wing, book, 512)} className="lib-reader-cover" />
        <p className={EYEBROW}>{[wing.doc.keeper.name, shelf?.name].filter(Boolean).join(" · ")}</p>
        <h2
          id={`${id}-t`}
          ref={headingRef}
          tabIndex={-1}
          className="text-[length:var(--pw-typography-size_h1)] font-semibold leading-tight text-[var(--pw-text-primary)] focus:outline-none"
          style={SERIF}
        >
          {book.title}
        </h2>
        {book.short ? <p className="text-[length:var(--pw-typography-size_lead)] text-[var(--pw-text-secondary)]">{book.short}</p> : null}
      </header>
      {pages.map((p, i) => (
        <div key={i} className="flex flex-col gap-[var(--pw-spacing-lg)]">
          {i > 0 && (p.kind === "plain" || p.kind === "voice") ? (
            <p className="lib-ornament" aria-hidden="true">✦ ✦ ✦</p>
          ) : null}
          <Page page={p} wing={wing} onBook={onBook} />
        </div>
      ))}
      {book.source || site ? (
        <p className={`${SMALL} flex flex-wrap items-center gap-[var(--pw-spacing-sm)]`}>
          {book.source ? <span>{`Where the full truth lives: ${book.source}`}</span> : null}
          {site ? (
            <a
              href={site}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex min-h-[var(--pw-targets-minimum)] items-center gap-[var(--pw-spacing-xs)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] px-[var(--pw-spacing-md)] font-semibold text-[var(--pw-text-primary)] ${FOCUS}`}
            >
              {`Read it on ${wing.doc.keeper.name}’s site`}
              <Icon name="external" size={16} />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
        </p>
      ) : null}
      {colophon ? (
        <div ref={colophonRef} className="lib-colophon">
          <p className={EYEBROW}>Colophon</p>
          <div className="lib-page text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            <Markdown text={colophon.text.replace(/^##\s+colophon\s*/i, "")} />
          </div>
        </div>
      ) : null}
      <div ref={endRef} aria-hidden="true" />
      <nav aria-label="More books on this shelf" className="flex flex-wrap gap-[var(--pw-spacing-sm)] border-t border-[var(--pw-border-subtle)] pt-[var(--pw-spacing-lg)]">
        {prev ? (
          <WorldButton variant="secondary" onPress={() => onOpen({ wing, book: prev })}>
            {`Previous: ${prev.title}`}
          </WorldButton>
        ) : null}
        {next ? (
          <WorldButton variant="secondary" onPress={() => onOpen({ wing, book: next })}>
            {`Next: ${next.title}`}
          </WorldButton>
        ) : null}
        <WorldButton variant="ghost" onPress={onBack}>
          All the shelves
        </WorldButton>
      </nav>
    </article>
  );
}

// ─── The page ─────────────────────────────────────────────────────────

export function Library({ onBack, backLabel = "Back to Settings" }: { onBack: () => void; backLabel?: string }) {
  const { libraries, unavailable, rows, loading } = useLibrary();
  const rooms = useRooms();
  const [open, setOpen] = useState<Open | null>(null);
  const returnTo = useRef<string | null>(null);
  const roomRows = rooms.data?.data ?? [];
  const nameOf = (room: string) => roomRows.find((r) => r.id === room)?.room?.name ?? room;
  const hasHive = libraries.some((l) => l.keeper.id === "hive-works") || rows.some((r) => r.room === "hive-works" && r.status === "ok");
  const crew = useRoomView<HiveCrewView>("hive-works", "crew", undefined, hasHive);

  const wings: Wing[] = (() => {
    const faces: Record<string, string> = {};
    for (const b of crew.data?.data?.crew ?? []) {
      const name = artName(b.face_file);
      if (name) faces[b.name.toLowerCase()] = roomArtUrl("hive-works", name);
    }
    return libraries.map((doc) => {
      const source = rows.find((r) => r.library === doc);
      const room = doc.keeper.id === "worlds" && !source ? null : (source?.room ?? doc.keeper.id);
      const look = doc.keeper.look && LOOKS.has(doc.keeper.look) ? doc.keeper.look : "plain";
      return {
        doc,
        room,
        row: room ? (roomRows.find((r) => r.id === room) ?? null) : null,
        look,
        faces: room === "hive-works" ? faces : {},
      };
    });
  })();
  const total = wings.reduce((n, w) => n + w.doc.books.filter((b) => b.shelf !== DRAFTS).length, 0);

  // Back from a book: focus returns to that book on its shelf.
  useEffect(() => {
    if (open || !returnTo.current) return;
    const title = returnTo.current;
    returnTo.current = null;
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`#main-content [aria-label="Open ${CSS.escape(title)}"]`);
      const drafts = el?.closest("details");
      if (drafts) drafts.open = true;
      el?.focus();
    });
  }, [open]);

  return (
    <main id="main-content" aria-label="Library" className="relative z-10 max-w-[1180px] p-[var(--pw-spacing-xl)] md:p-[var(--pw-spacing-3xl)]">
      {open ? (
        <Reader
          open={open}
          onOpen={(o) => {
            setOpen(o);
            window.scrollTo({ top: 0 });
          }}
          onBack={() => {
            returnTo.current = open.book.title;
            setOpen(null);
          }}
        />
      ) : (
        <>
          <WorldButton variant="ghost" onPress={onBack} className="mb-[var(--pw-spacing-md)]">
            <Icon name="back" size={16} className="mr-[var(--pw-spacing-xs)]" />
            {backLabel}
          </WorldButton>
          <header className="mb-[var(--pw-spacing-xl)] flex flex-wrap items-center gap-[var(--pw-spacing-lg)]">
            <SolMoment mood="reading" size={96} />
            <div className="min-w-[14rem] flex-1">
              <h1 className="text-[length:var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]" style={SERIF}>
                Library
              </h1>
              <p className="max-w-[62ch] text-[var(--pw-text-secondary)]">
                Short books on how things work, for everyone. Each starts with one plain sentence, and you can go as deep as
                you like. Every app in your World can lend its shelves.
              </p>
            </div>
          </header>

          {wings.length > 1 && (
            <nav aria-label="Whose shelves" className="mb-[var(--pw-spacing-xl)] flex flex-wrap items-center gap-[var(--pw-spacing-sm)]">
              <span className={SMALL}>{`${plural(total, "book", "books")} from ${plural(wings.length, "keeper", "keepers")}:`}</span>
              {wings.map((w) => (
                <a
                  key={w.doc.keeper.id}
                  href={`#wing-${w.doc.keeper.id}`}
                  className={`inline-flex min-h-[var(--pw-targets-minimum)] items-center rounded-full border border-[var(--pw-border-subtle)] px-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-primary)] ${FOCUS}`}
                >
                  {`${w.doc.keeper.name} · ${w.doc.books.filter((b) => b.shelf !== DRAFTS).length}`}
                </a>
              ))}
            </nav>
          )}

          <div className="flex flex-col gap-[var(--pw-spacing-2xl)]">
            {wings.map((w) => (
              <WingSection key={w.doc.keeper.id} wing={w} onOpen={setOpen} />
            ))}
          </div>

          {(loading || unavailable.length > 0) && (
            <ul className="mt-[var(--pw-spacing-xl)] flex flex-col gap-[var(--pw-spacing-sm)]">
              {loading ? <li className={SMALL}>Finding the other apps’ shelves…</li> : null}
              {unavailable.map((u) => (
                <li key={u.room} className={`${SMALL} flex items-center gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-md)]`}>
                  <SolMoment mood="sleeping" size={40} />
                  <span>{`Couldn’t read ${nameOf(u.room)}’s library just now.${u.error ? ` ${u.error}` : ""} Its shelves will come back when it answers.`}</span>
                </li>
              ))}
            </ul>
          )}
          <p className={`${SMALL} mt-[var(--pw-spacing-xl)]`}>
            More shelves appear here as apps that keep a library join your World.
          </p>
        </>
      )}
    </main>
  );
}
