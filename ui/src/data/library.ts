/**
 * The Worlds Library's own books: docs/library/*.md, bundled into the app
 * at build time (the same format as VEFR's Library). Each book has a small
 * header (`title`, `kind: book`, `order`, `for`, `short`) and pages split
 * by a line `* * *`. The library README is the shelf's index, not a book.
 *
 * Written for technical and non-technical readers alike, in layers:
 * `short` is one plain sentence; ordinary pages are plain words; a page
 * that starts "## Words to know" is the glossary (official term → plain
 * meaning); a page that starts "## Under the hood" is for technical
 * readers (the UI may fold it away).
 *
 * Hive Works' shelf comes from its room instead:
 * useRoomView("hive-works", "library").
 */

export type PageKind = "plain" | "voice" | "words" | "technical";

export interface LibraryPage {
  kind: PageKind;
  /** Markdown, without the "## Words to know" / "## Under the hood" line. */
  text: string;
  /** Who speaks a voice page ("## In Sol's words" → "Sol"). */
  voice?: string;
}

export interface LibraryBook {
  /** The file name without ".md", e.g. "02-rooms". */
  id: string;
  title: string;
  order: number;
  /** Who it's written for, e.g. "everyone". */
  audience: string;
  /** Which Worlds shelf: "worlds" (how Worlds works) or "words" (words for what you make). */
  shelf: string;
  /** One plain sentence: what the book is about. */
  short: string;
  pages: LibraryPage[];
}

/** One book from its Markdown, or null when it isn't a book. */
export function parseBook(id: string, source: string): LibraryBook | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
  if (!match) return null;
  const header: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const at = line.indexOf(":");
    if (at > 0) header[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  if (header.kind !== "book" || !header.title) return null;
  const pages = match[2]
    .split(/^\s*\* \* \*\s*$/m)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(toPage);
  if (pages.length === 0) return null;
  const order = Number.parseInt(header.order ?? "", 10);
  return {
    id,
    title: header.title,
    order: Number.isFinite(order) ? order : 999,
    audience: header.for ?? "everyone",
    shelf: header.shelf ?? "worlds",
    short: header.short ?? "",
    pages,
  };
}

function toPage(text: string): LibraryPage {
  const first = /^##\s+(.+)\r?\n?/.exec(text);
  const heading = first?.[1].trim().toLowerCase();
  if (heading === "words to know") return { kind: "words", text: text.slice(first![0].length).trim() };
  if (heading === "under the hood") return { kind: "technical", text: text.slice(first![0].length).trim() };
  const voice = /^in (.+?)[’']s words$/i.exec(first?.[1].trim() ?? "");
  if (voice) return { kind: "voice", voice: voice[1], text: text.slice(first![0].length).trim() };
  return { kind: "plain", text };
}

const files = import.meta.glob(["../../../docs/library/*.md", "../../../docs/library/concepts/*.md"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** Play-Nice `library/0`: one keeper's shelves and books. Worlds is the
 *  home: its own shelf comes first, then every connected room's library
 *  (GET /api/library), each under its keeper, never merged. */
export interface LibraryDoc {
  contract: "library/0";
  generated_at: string;
  keeper: { id: string; name: string; look?: string };
  shelves: { id: string; name: string; look?: string; cover?: string; blurb?: string }[];
  books: {
    id: string;
    shelf: string;
    title: string;
    short: string;
    order?: number;
    cover?: string;
    source?: string;
    link?: string;
    updated_at?: string;
    pages: LibraryPage[];
  }[];
  /** Tap to learn (library 1.1.0): lower-case term → its plain meaning,
   *  the keeper's own name for it, and other spellings. */
  glossary?: Glossary;
}

export type Glossary = Record<string, { plain: string; local?: string; also?: string[] }>;

/** The glossary entry an *italic* word stands for (by key or an `also`,
 *  ignoring case), or null: an italic word with no entry stays italic. */
export function glossaryEntry(glossary: Glossary | undefined, word: string) {
  if (!glossary) return null;
  const w = word.trim().toLowerCase();
  if (!w) return null;
  if (Object.hasOwn(glossary, w)) return { term: w, ...glossary[w] };
  for (const [term, e] of Object.entries(glossary)) {
    if (e.also?.some((a) => a.trim().toLowerCase() === w)) return { term, ...e };
  }
  return null;
}

/** One connected room's library, as GET /api/library reports it. */
export interface RoomLibraryRow {
  room: string;
  status: "ok" | "unavailable";
  library?: LibraryDoc;
  error?: string;
}

/** Every book on the Worlds shelf, in reading order. */
export const worldsBooks: LibraryBook[] = Object.entries(files)
  .map(([path, source]) => parseBook(path.split("/").pop()!.replace(/\.md$/, ""), source))
  .filter((b): b is LibraryBook => b !== null)
  .sort((a, b) => (a.shelf === b.shelf ? 0 : a.shelf === "worlds" ? -1 : 1) || a.order - b.order || a.id.localeCompare(b.id));

/** Worlds' own library as a `library/0` document (look: scifi-storybook). */
export const worldsLibrary: LibraryDoc = {
  contract: "library/0",
  generated_at: "",
  keeper: { id: "worlds", name: "Worlds", look: "scifi-storybook" },
  shelves: [
    { id: "worlds", name: "How Worlds works", look: "scifi-storybook" },
    { id: "words", name: "Words for what you make", look: "scifi-storybook", blurb: "One book per idea, however you met it." },
  ],
  books: worldsBooks.map((b) => ({
    id: b.id,
    shelf: b.shelf,
    title: b.title,
    short: b.short,
    order: b.order,
    source: b.shelf === "words" ? `docs/library/concepts/${b.id}.md` : `docs/library/${b.id}.md`,
    pages: b.pages,
  })),
};
