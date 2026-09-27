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

export type PageKind = "plain" | "words" | "technical";

export interface LibraryPage {
  kind: PageKind;
  /** Markdown, without the "## Words to know" / "## Under the hood" line. */
  text: string;
}

export interface LibraryBook {
  /** The file name without ".md", e.g. "02-rooms". */
  id: string;
  title: string;
  order: number;
  /** Who it's written for, e.g. "everyone". */
  audience: string;
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
    short: header.short ?? "",
    pages,
  };
}

function toPage(text: string): LibraryPage {
  const first = /^##\s+(.+)\r?\n?/.exec(text);
  const heading = first?.[1].trim().toLowerCase();
  if (heading === "words to know") return { kind: "words", text: text.slice(first![0].length).trim() };
  if (heading === "under the hood") return { kind: "technical", text: text.slice(first![0].length).trim() };
  return { kind: "plain", text };
}

const files = import.meta.glob("../../../docs/library/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** Every book on the Worlds shelf, in reading order. */
export const worldsBooks: LibraryBook[] = Object.entries(files)
  .map(([path, source]) => parseBook(path.split("/").pop()!.replace(/\.md$/, ""), source))
  .filter((b): b is LibraryBook => b !== null)
  .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
