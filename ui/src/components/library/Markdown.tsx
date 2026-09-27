/**
 * A small, safe Markdown reader for Library pages: paragraphs, bullet and
 * numbered lists (wrapped lines join their item), simple tables, and
 * inline **bold**, *italic*, `code` and [links](…). It builds React
 * elements only, never raw HTML, so a keeper's text can't inject markup.
 *
 * Links: http(s) opens in a new tab; a path goes through `resolveLink`
 * (a room's site); a link to another book ("02-rooms.md") calls
 * `onBook`; anything else stays plain text.
 *
 * Tap to learn (library 1.1.0): an *italic* word that matches the
 * library's glossary becomes a word you can press. It shows a small card
 * (the word, its plain meaning, and "In <keeper>: <local name>"), only
 * when asked; "Got it" closes it and puts focus back on the word.
 */
import { Fragment, useId, useRef, useState, type ReactNode } from "react";
import { glossaryEntry, type Glossary } from "../../data/library";

export interface MarkdownProps {
  text: string;
  /** Opens another book on the same shelf, from a "02-rooms.md" link. */
  onBook?: (id: string) => void;
  /** Turns a site path into a full address (the keeper's site), or null. */
  resolveLink?: (path: string) => string | null;
  /** The library's shared glossary; italic words that match are tappable. */
  glossary?: Glossary;
  /** The keeper's name, for "In <keeper>: <local>". */
  keeper?: string;
}

function Term({ word, entry, keeper }: { word: ReactNode; entry: NonNullable<ReturnType<typeof glossaryEntry>>; keeper?: string }) {
  const [open, setOpen] = useState(false);
  const wordRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  return (
    <>
      <button
        ref={wordRef}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="lib-term inline rounded-[var(--pw-radius-sm)] bg-transparent p-0 text-left italic text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]"
      >
        {word}
      </button>
      <span id={id} role="status" aria-live="polite" className={open ? "lib-term-card" : "sr-only"}>
        {open ? (
          <>
            <span className="block font-semibold not-italic text-[var(--pw-text-primary)]">{entry.term}</span>
            <span className="block not-italic text-[var(--pw-text-secondary)]">{entry.plain}</span>
            {entry.local && keeper ? (
              <span className="block not-italic text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
                {`In ${keeper}: ${entry.local}`}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                wordRef.current?.focus();
              }}
              className="mt-[var(--pw-spacing-sm)] inline-flex min-h-[var(--pw-targets-minimum)] items-center rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] px-[var(--pw-spacing-md)] font-semibold not-italic text-[var(--pw-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]"
            >
              Got it
            </button>
          </>
        ) : null}
      </span>
    </>
  );
}

type Block =
  | { type: "p"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] };

const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBER = /^\s*\d+\.\s+(.*)$/;

function blocks(text: string): Block[] {
  const out: Block[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      if (rows.length) out.push({ type: "table", head: rows[0], rows: rows.slice(1) });
      continue;
    }
    const kind = BULLET.test(line) ? "ul" : NUMBER.test(line) ? "ol" : null;
    if (kind) {
      const re = kind === "ul" ? BULLET : NUMBER;
      const items: string[] = [];
      while (i < lines.length && lines[i].trim()) {
        const m = re.exec(lines[i]);
        if (m) items.push(m[1]);
        else if (items.length && /^\s+/.test(lines[i])) items[items.length - 1] += ` ${lines[i].trim()}`;
        else break;
        i++;
      }
      out.push({ type: kind, items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !BULLET.test(lines[i]) && !NUMBER.test(lines[i]) && !lines[i].trim().startsWith("|")) {
      para.push(lines[i].trim());
      i++;
    }
    out.push({ type: "p", text: para.join(" ") });
  }
  return out;
}

const INLINE = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_)/g;

function inline(text: string, p: MarkdownProps, key = ""): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const k = `${key}-${n++}`;
    if (m[2] !== undefined) out.push(<strong key={k} className="font-semibold text-[var(--pw-text-primary)]">{inline(m[2], p, k)}</strong>);
    else if (m[3] !== undefined)
      out.push(
        <code key={k} className="rounded-[var(--pw-radius-sm)] bg-[var(--pw-surface-hull)] px-1 font-mono text-[0.92em] text-[var(--pw-text-primary)]">
          {m[3]}
        </code>,
      );
    else if (m[4] !== undefined) out.push(<Fragment key={k}>{link(m[4], m[5], p, k)}</Fragment>);
    else {
      const words = m[6] ?? m[7];
      const entry = glossaryEntry(p.glossary, words);
      out.push(
        entry ? (
          <Term key={k} word={inline(words, p, k)} entry={entry} keeper={p.keeper} />
        ) : (
          <em key={k}>{inline(words, p, k)}</em>
        ),
      );
    }
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const A =
  "rounded-[var(--pw-radius-sm)] font-semibold text-[var(--pw-accent-primary)] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]";

function link(label: string, href: string, p: MarkdownProps, key: string): ReactNode {
  const book = /^(?:\.\/)?(\d{2}-[a-z0-9-]+)\.md$/.exec(href);
  if (book && p.onBook) {
    return (
      <button type="button" className={`${A} inline min-h-0 bg-transparent p-0 text-left`} onClick={() => p.onBook!(book[1])}>
        {label}
      </button>
    );
  }
  const url = /^https?:\/\//.test(href) ? href : href.startsWith("/") && p.resolveLink ? p.resolveLink(href) : null;
  if (!url) return <span key={key}>{label}</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={A}>
      {label}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function Markdown(props: MarkdownProps) {
  return (
    <>
      {blocks(props.text).map((b, i) => {
        if (b.type === "p") return <p key={i}>{inline(b.text, props, `p${i}`)}</p>;
        if (b.type === "table") {
          return (
            <div key={i} className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>
                    {b.head.map((h, j) => (
                      <th key={j} scope="col" className="border-b border-[var(--pw-border-subtle)] py-[var(--pw-spacing-xs)] pr-[var(--pw-spacing-md)] font-semibold text-[var(--pw-text-primary)]">
                        {inline(h, props, `h${i}-${j}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, j) => (
                    <tr key={j}>
                      {r.map((c, k) => (
                        <td key={k} className="border-b border-[var(--pw-border-subtle)] py-[var(--pw-spacing-xs)] pr-[var(--pw-spacing-md)] align-top">
                          {inline(c, props, `c${i}-${j}-${k}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        const List = b.type;
        return (
          <List key={i} className={`${b.type === "ul" ? "list-disc" : "list-decimal"} flex flex-col gap-[var(--pw-spacing-xs)] pl-[1.4em]`}>
            {b.items.map((it, j) => (
              <li key={j}>{inline(it, props, `l${i}-${j}`)}</li>
            ))}
          </List>
        );
      })}
    </>
  );
}
