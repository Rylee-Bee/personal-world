/**
 * The Library's Markdown reader: the few things books use, rendered as
 * React elements only, so a keeper's text can never inject markup.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Markdown } from "../components/library/Markdown";

afterEach(cleanup);

describe("Library Markdown", () => {
  it("renders paragraphs, wrapped list items, a table and inline marks", () => {
    const { container } = render(
      <Markdown
        text={"One **bold** and *soft* and `code`.\njoined line.\n\n1. **First.** Starts here\n   and wraps.\n2. Second.\n\n| Role | Can |\n|---|---|\n| Owner | Everything |"}
      />,
    );
    expect(container.querySelector("p")?.textContent).toBe("One bold and soft and code. joined line.");
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelector("em")?.textContent).toBe("soft");
    expect(container.querySelector("code")?.textContent).toBe("code");
    const items = Array.from(container.querySelectorAll("ol li")).map((li) => li.textContent);
    expect(items).toEqual(["First. Starts here and wraps.", "Second."]);
    expect(screen.getByRole("columnheader", { name: "Role" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Everything" })).toBeInTheDocument();
  });

  it("never turns text into markup", () => {
    const { container } = render(<Markdown text={'<img src=x onerror="alert(1)"> <script>bad()</script>'} />);
    expect(container.querySelector("img, script")).toBeNull();
    expect(container.textContent).toContain("<script>bad()</script>");
  });

  it("opens another book from a book link, keeps unsafe links as text, and resolves site paths", async () => {
    const onBook = vi.fn();
    render(
      <Markdown
        text={"See [Rooms](02-rooms.md), [odd](javascript:alert(1)), [the site](/tickets/HW-1) and [web](https://example.test/a)."}
        onBook={onBook}
        resolveLink={(p) => `https://hive.example.test${p}`}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Rooms" }));
    expect(onBook).toHaveBeenCalledWith("02-rooms");
    expect(screen.queryByRole("link", { name: /odd/ })).toBeNull();
    expect(screen.getByRole("link", { name: /the site/ })).toHaveAttribute("href", "https://hive.example.test/tickets/HW-1");
    expect(screen.getByRole("link", { name: /web/ })).toHaveAttribute("target", "_blank");
  });
});

describe("tap to learn", () => {
  const glossary = { commit: { plain: "A saved snapshot you can go back to.", local: "Keep" } };

  it("turns a glossary word into a button, shows the card only when asked, and Got it returns focus", async () => {
    const user = userEvent.setup();
    render(<Markdown text={"Each *commit* is a checkpoint, and *nothing* else is special."} glossary={glossary} keeper="VEFR" />);
    const word = screen.getByRole("button", { name: "commit" });
    expect(word).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("A saved snapshot you can go back to.")).toBeNull();
    // An italic word with no entry stays plain italic.
    expect(screen.queryByRole("button", { name: "nothing" })).toBeNull();
    await user.click(word);
    expect(word).toHaveAttribute("aria-expanded", "true");
    const card = screen.getByRole("status");
    expect(card).toHaveTextContent("A saved snapshot you can go back to.");
    expect(card).toHaveTextContent("In VEFR: Keep");
    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByText("A saved snapshot you can go back to.")).toBeNull();
    expect(word).toHaveFocus();
  });
});
