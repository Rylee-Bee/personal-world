import { describe, it, expect } from "vitest";
import { glossaryEntry, parseBook, worldsBooks } from "../data/library";

describe("the Worlds Library", () => {
  it("bundles every book in docs/library, in reading order, never the README", () => {
    expect(worldsBooks.length).toBeGreaterThanOrEqual(11);
    expect(worldsBooks[0].title).toBe("How Worlds fits together");
    for (const shelf of ["worlds", "words"]) {
      const orders = worldsBooks.filter((b) => b.shelf === shelf).map((b) => b.order);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    }
    expect(worldsBooks.some((b) => b.id === "README")).toBe(false);
    for (const b of worldsBooks) {
      expect(b.pages.length).toBeGreaterThan(0);
      expect(b.short, b.id).not.toBe("");
      expect(b.pages[0].kind, b.id).toBe("plain");
    }
  });

  it("splits pages on * * * and reads the header", () => {
    const book = parseBook(
      "x",
      "---\ntitle: Test\nkind: book\norder: 3\nfor: everyone\nshort: A test.\n---\nOne.\n\n* * *\n\n## Words to know\n\n**Vault:** a safe.\n\n* * *\n\n## Under the hood\n\n`vault.py`\n",
    );
    expect(book).toEqual({
      id: "x",
      title: "Test",
      order: 3,
      audience: "everyone",
      shelf: "worlds",
      short: "A test.",
      pages: [
        { kind: "plain", text: "One." },
        { kind: "words", text: "**Vault:** a safe." },
        { kind: "technical", text: "`vault.py`" },
      ],
    });
  });

  it("ignores files that aren't books", () => {
    expect(parseBook("r", "# The Worlds library\n")).toBeNull();
    expect(parseBook("n", "---\ntitle: Notes\nkind: notes\n---\nx")).toBeNull();
  });
});

describe("the library home", () => {
  it("reads a voice page and presents Worlds as a library/0 keeper", async () => {
    const { parseBook, worldsLibrary } = await import("../data/library");
    const b = parseBook("v", "---\ntitle: V\nkind: book\nshort: S.\n---\nPlain.\n\n* * *\n\n## In Sol's words\n\nHello.\n");
    expect(b?.pages[1]).toEqual({ kind: "voice", voice: "Sol", text: "Hello." });
    expect(worldsLibrary.contract).toBe("library/0");
    expect(worldsLibrary.keeper).toEqual({ id: "worlds", name: "Worlds", look: "scifi-storybook" });
    expect(worldsLibrary.books.every((x) => x.pages[0].kind === "plain")).toBe(true);
    expect(worldsLibrary.books.filter((x) => x.shelf === "words").map((x) => x.id)).toEqual([
      "gating", "signposting", "affordance", "visual-language", "exploration-reward", "discoverability",
    ]);
  });
});

describe("book 17 and tap to learn", () => {
  it("book 17 is on the shelf, with a voice page in Claude's words", () => {
    const made = worldsBooks.find((b) => b.id === "17-how-the-interface-was-made");
    expect(made?.pages[0].kind).toBe("plain");
    expect(made?.pages.some((p) => p.kind === "voice" && p.voice === "Claude")).toBe(true);
  });

  it("matches a glossary term by key or another spelling, ignoring case", () => {
    const g = { commit: { plain: "A saved snapshot you can go back to.", local: "Keep", also: ["commits", "Committed"] } };
    expect(glossaryEntry(g, "Commit")).toMatchObject({ term: "commit", local: "Keep" });
    expect(glossaryEntry(g, "committed")?.term).toBe("commit");
    expect(glossaryEntry(g, "branch")).toBeNull();
    expect(glossaryEntry(undefined, "commit")).toBeNull();
    // Only the glossary's own keys, never inherited object names.
    expect(glossaryEntry(g, "constructor")).toBeNull();
  });
});
