import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Meter } from "../fd/Meter";
import { Row } from "../fd/Row";
import { cards, homeBoard } from "../fd/fixtures";

const item = (id: string) => homeBoard.items.find((i) => i.card === id)!;
const row = (id: string, props: Partial<Parameters<typeof Row>[0]> = {}) =>
  render(<Row item={item(id)} card={cards[id]} words="short" density="standard" timeZone="UTC" expanded={false} onToggle={() => undefined} {...props} />);

afterEach(cleanup);

describe("Meter", () => {
  it("exposes the text equivalent as the accessible name", () => {
    render(<Meter meter={cards.disk.meter} frozen={false} />);
    expect(screen.getByRole("img", { name: "61 percent used" })).toBeInTheDocument();
  });
  it("renders nothing for a null meter", () => {
    const { container } = render(<Meter meter={null} frozen={false} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("draws nothing when the API sends a meter with no data to draw", () => {
    const bare = { type: "progress", text_equivalent: "Uptime: 1h 2m" } as const;
    const { container } = render(<Meter meter={bare} frozen={false} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("an explicit 0 is real and draws; a missing number does not", () => {
    const { container, rerender } = render(<Meter meter={{ type: "progress", value: 0, max: 1, text_equivalent: "0 of 1" }} frozen={false} />);
    expect(container.querySelector(".fd-fill")).not.toBeNull();
    rerender(<Meter meter={{ type: "progress", max: 1, text_equivalent: "x" }} frozen={false} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("marks a frozen meter", () => {
    render(<Meter meter={cards.downloads.meter} frozen />);
    expect(screen.getByRole("img")).toHaveAttribute("data-frozen", "true");
  });
  it("shows only waiting marks plus +N more", () => {
    render(<Meter meter={{ type: "marks", items: ["a", "b", "c", "d", "e", "f", "g", "h"], text_equivalent: "8 waiting" }} frozen={false} />);
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });
  it("puts day labels under the track as text", () => {
    render(<Meter meter={cards.weather.meter} frozen={false} />);
    expect(screen.getByText("Walk")).toBeInTheDocument();
    expect(screen.getByText("Call")).toBeInTheDocument();
  });
});

describe("Row anatomy", () => {
  it("healthy: name, meaning, value with unit, state shape and word", () => {
    row("disk");
    expect(screen.getByText("Disk")).toBeInTheDocument();
    expect(screen.getByText("Disk space")).toBeInTheDocument();
    expect(screen.getByText("61")).toBeInTheDocument();
    expect(screen.getByText("%")).toBeInTheDocument();
    expect(screen.getByText("●")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
  });
  it("unavailable keeps last-good, frozen, with 'as of' time", () => {
    row("downloads");
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText("■")).toBeInTheDocument();
    expect(screen.getByText("Last good 08:12")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("data-frozen", "true");
  });
  it("a value of text \"unknown\" with no raw shows a dash, never 0 or the word, and no meter", () => {
    row("malformed");
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getByText("unknown")).toHaveClass("fd-sr");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
  it("an empty list is healthy and shows 'none'", () => {
    row("later");
    expect(screen.getByText("none")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
  });
  it("Words: Minimal drops meaning; Full shows the long meaning and freshness", () => {
    const { unmount } = row("disk", { words: "minimal" });
    expect(screen.queryByText("Disk space")).not.toBeInTheDocument();
    expect(screen.getByText("61")).toBeInTheDocument();
    unmount();
    row("disk", { words: "full" });
    expect(screen.getByText("How full the main disk is.")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
  });
  it("a problem row always says when it was last good; unknown says never", () => {
    row("malformed");
    expect(screen.getByText("Last good —")).toBeInTheDocument();
    expect(screen.getByText("Last good: never")).toHaveClass("fd-sr");
  });
  it("does not repeat the name as its meaning", () => {
    row("malformed");
    expect(screen.getAllByText("Calendar")).toHaveLength(1);
    expect(screen.getByText("Today's events")).toBeInTheDocument();
  });
  it("the drill-in shows field labels, never keys", () => {
    row("downloads", { expanded: true });
    const region = screen.getByRole("region", { name: "Downloads details" });
    expect(within(region).getByText("Active")).toBeInTheDocument();
    expect(within(region).queryByText("active")).not.toBeInTheDocument();
  });
  it("the whole row is one disclosure button", async () => {
    const onToggle = vi.fn();
    row("disk", { onToggle });
    const btn = screen.getByRole("button", { name: /Disk/ });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(btn);
    expect(onToggle).toHaveBeenCalled();
  });
  it("drill-in order: meaning, state, detail, freshness, evidence disclosure, Connect", () => {
    row("downloads", { expanded: true });
    const region = screen.getByRole("region", { name: "Downloads details" });
    const text = region.textContent ?? "";
    const at = (s: string) => text.indexOf(s);
    expect(at("The queue Sonarr")).toBeGreaterThanOrEqual(0);
    expect(at("The queue Sonarr")).toBeLessThan(at("Unavailable"));
    expect(at("Unavailable")).toBeLessThan(at("Last good 08:12"));
    const ev = within(region).getByText("Technical evidence");
    expect(ev.closest("summary")).not.toBeNull();
    expect(at("Last good 08:12")).toBeLessThan(text.indexOf("Technical evidence"));
    expect(within(region).getByRole("link", { name: "Open in Connect" })).toHaveAttribute("href", "#connect");
    expect(region.querySelector("details")).toHaveTextContent(/sonarr\.queue/);
    expect(region.querySelector("details")).toHaveTextContent(/http_5xx/);
  });
  it("Detailed density opens the evidence", () => {
    row("downloads", { expanded: true, density: "detailed" });
    expect(screen.getByRole("region").querySelector("details")).toHaveAttribute("open");
  });
});
