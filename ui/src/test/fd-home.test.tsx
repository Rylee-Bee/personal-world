import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Home } from "../fd/Home";
import { handlers } from "../fd/msw";
import { PrefsProvider } from "../fd/prefs";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderHome = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PrefsProvider><Home timeZone="UTC" /></PrefsProvider>
    </QueryClientProvider>,
  );

describe("Home", () => {
  it("orders: greeting, briefing, strip, Edit Home, then the five sections", async () => {
    renderHome();
    await screen.findByRole("heading", { name: "Needs you" });
    const main = document.body;
    const heads = within(main).getAllByRole("heading").map((h) => h.textContent);
    expect(heads).toEqual(["Home", "Needs you", "Needs a look", "Pick up", "Your life", "Quietly working"]);
    expect(screen.getByText("1 for you · Downloads down · Backup stale · rest quiet")).toBeInTheDocument();
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
    expect(b).toHaveLength(10);
    expect(within(strip).getByRole("button", { name: "Downloads: Unavailable. Show details" })).toBeInTheDocument();
    expect(within(strip).getByRole("button", { name: "Disk: Healthy. Show details" })).toBeInTheDocument();
    expect(within(strip).getByRole("button", { name: "Music: Not configured. Show details" })).toBeInTheDocument();
  });
  it("sections hold the right rows and Needs you is finite", async () => {
    renderHome();
    const needsYou = (await screen.findByRole("heading", { name: "Needs you" })).closest("section")!;
    expect(within(needsYou).getAllByRole("listitem")).toHaveLength(1);
    const look = screen.getByRole("heading", { name: "Needs a look" }).closest("section")!;
    const names = within(look).getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(names[0]).toMatch(/Downloads/);
    expect(names[1]).toMatch(/Backup/);
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
