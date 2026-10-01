import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Home } from "../fd/Home";
import { handlers } from "../fd/msw";
import { PrefsProvider } from "../fd/prefs";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { cleanup(); server.resetHandlers(); });
afterAll(() => server.close());

const renderHome = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PrefsProvider><Home timeZone="UTC" /></PrefsProvider>
    </QueryClientProvider>,
  );

describe("Home", () => {
  it("orders: briefing, strip, Edit Home, then the sections (Pick up omitted when empty)", async () => {
    renderHome();
    await screen.findByRole("heading", { name: "Needs you" });
    const main = document.body;
    const heads = within(main).getAllByRole("heading").map((h) => h.textContent);
    expect(heads).toEqual(["Home", "Needs you", "Needs a look", "Your life", "Quietly working"]);
    expect(screen.getByText("2 for you · Downloads down · Backup stale · 1 more to look at · rest quiet")).toBeInTheDocument();
    const strip = screen.getByRole("group", { name: "Whole world" });
    const edit = screen.getByRole("button", { name: "Edit Home" });
    const needsYou = screen.getByRole("heading", { name: "Needs you" });
    expect(strip.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(edit.compareDocumentPosition(needsYou) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("strip: one button per source named 'Name: State. Show details'", async () => {
    renderHome();
    const strip = await screen.findByRole("group", { name: "Whole world" });
    const b = within(strip).getAllByRole("button");
    expect(b).toHaveLength(8);
    expect(within(strip).getByRole("button", { name: "Downloads: Unavailable. Show details" })).toBeInTheDocument();
    expect(within(strip).getByRole("button", { name: "Disk: Healthy. Show details" })).toBeInTheDocument();
    const music = within(strip).getByRole("link", { name: "Music: Not configured. Set up in Connect" });
    expect(music).toHaveAttribute("href", "#connect");
  });
  it("sections hold the right rows and Needs you is finite", async () => {
    renderHome();
    const needsYou = (await screen.findByRole("heading", { name: "Needs you" })).closest("section")!;
    expect(within(needsYou).getAllByRole("listitem")).toHaveLength(2);
    expect(within(needsYou).getByText("Approve Hive Works plan")).toBeInTheDocument();
    expect(within(needsYou).getByRole("button", { name: "Approve: Approve Hive Works plan" })).toBeInTheDocument();
    expect(within(needsYou).getByRole("link", { name: "Open: Review the new reading list" })).toHaveAttribute("href", "#memory");
    const look = screen.getByRole("heading", { name: "Needs a look" }).closest("section")!;
    const names = within(look).getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(names[0]).toMatch(/Downloads/);
    expect(names[1]).toMatch(/Backup/);
    expect(names[2]).toMatch(/Calendar/);
    expect(screen.queryByRole("heading", { name: "Pick up" })).not.toBeInTheDocument();
  });
  it("not_configured is never a row", async () => {
    renderHome();
    await screen.findByRole("heading", { name: "Your life" });
    for (const li of screen.getAllByRole("listitem")) expect(li).not.toHaveTextContent("Music");
  });
  it("empty Needs you says so; the section stays", async () => {
    const { http, HttpResponse } = await import("msw");
    server.use(http.get("/api/needs-you", () => HttpResponse.json([])));
    renderHome();
    const sec = (await screen.findByRole("heading", { name: "Needs you" })).closest("section")!;
    expect(within(sec).getByText("Nothing for you right now.")).toBeInTheDocument();
  });
  it("opens a row's drill-in in place and closes it again", async () => {
    renderHome();
    const look = (await screen.findByRole("heading", { name: "Needs a look" })).closest("section")!;
    const btn = within(look).getByRole("button", { name: /Downloads/ });
    await userEvent.click(btn);
    expect(screen.getByRole("region", { name: "Downloads details" })).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(btn);
    expect(screen.queryByRole("region", { name: "Downloads details" })).not.toBeInTheDocument();
  });
  it("selecting a strip source opens its drill-in", async () => {
    renderHome();
    await userEvent.click(await screen.findByRole("button", { name: "Disk: Healthy. Show details" }));
    expect(screen.getByRole("region", { name: "Disk details" })).toBeInTheDocument();
  });
  it("a card that fails to load shows Unknown and never 0", async () => {
    const { http, HttpResponse } = await import("msw");
    server.use(http.get("/api/cards/disk", () => HttpResponse.json({}, { status: 500 })));
    renderHome();
    const strip = await screen.findByRole("group", { name: "Whole world" });
    expect(await within(strip).findByRole("button", { name: "Disk: Unknown. Show details" })).toBeInTheDocument();
  });
});
