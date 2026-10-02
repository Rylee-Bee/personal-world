import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Connect } from "../fd/Connect";
import { handlers as fdHandlers } from "../fd/msw";
import { Memory } from "../fd/Memory";
import { PrefsProvider } from "../fd/prefs";
import { usePrefs } from "../fd/prefs-core";
import { Settings } from "../fd/Settings";

const server = setupServer(...fdHandlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { cleanup(); server.resetHandlers(); });
afterAll(() => server.close());

afterEach(cleanup);

const tabNames = () => screen.getAllByRole("tab").map((t) => t.textContent);

const renderConnect = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Connect /></QueryClientProvider>);
};

describe("Connect", () => {
  it("has the six tabs and one panel", async () => {
    renderConnect();
    expect(tabNames()).toEqual(["Requests", "Providers", "Cards", "Recipes", "Actions", "Advanced"]);
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    await userEvent.click(screen.getByRole("tab", { name: "Actions" }));
    expect(screen.getByRole("tab", { name: "Actions" })).toHaveAttribute("aria-selected", "true");
  });
  it("each empty tab has its own sentence", async () => {
    renderConnect();
    const texts = new Set<string>();
    for (const name of ["Requests", "Providers", "Recipes"]) {
      await userEvent.click(screen.getByRole("tab", { name }));
      texts.add(screen.getByRole("tabpanel").textContent ?? "");
    }
    expect(texts.size).toBe(3);
  });
  it("Actions: a write asks first in a modal dialog, safe choice first and focused, then shows a receipt", async () => {
    renderConnect();
    await userEvent.click(screen.getByRole("tab", { name: "Actions" }));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("Read Sonarr queue")).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /Run: Read Sonarr queue/ })).not.toBeInTheDocument();
    const run = within(panel).getByRole("button", { name: "Run: Restart Sonarr" });
    await userEvent.click(run);
    const dlg = screen.getByRole("dialog", { name: "Restart Sonarr?" });
    expect(within(dlg).getByText("Sonarr stops for a moment and TV will show as unavailable until it is back.")).toBeInTheDocument();
    expect(within(dlg).getByText("Sample, nothing was sent.")).toBeInTheDocument();
    const buttons = within(dlg).getAllByRole("button").map((b) => b.textContent);
    expect(buttons).toEqual(["Don't restart", "Restart Sonarr"]);                  // the safe choice is first
    expect(within(dlg).getByRole("button", { name: "Don't restart" })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("");                     // nothing happened yet
    await userEvent.click(within(dlg).getByRole("button", { name: "Don't restart" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(run).toHaveFocus();
    await userEvent.click(run);
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restart Sonarr" }));
    expect(screen.getByRole("status")).toHaveTextContent("Restart Sonarr: Succeeded. Sample, nothing was sent.");
    expect(run).toHaveFocus();
    expect(screen.getByText("Sample data")).toBeInTheDocument();
  });
  it("an unconfirmed result is never shown bare", async () => {
    renderConnect();
    await userEvent.click(screen.getByRole("tab", { name: "Actions" }));
    await userEvent.click(screen.getByRole("button", { name: "Run: Start a backup" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Start a backup" }));
    expect(screen.getByRole("status")).toHaveTextContent("Unknown: the result was not confirmed");
  });
  it("Advanced: diagnostics list config kinds and errors, with no password input and no Replace control", async () => {
    server.use(
      http.get("/api/config/provider", () => HttpResponse.json({ items: [], errors: [{ file: "providers.yaml", reason: "bad yaml" }] })),
      http.get("/api/config/request", () => HttpResponse.json({ items: [{ id: "weather.now", etag: '"v1"', object: { id: "weather.now", provider: "weather", method: "GET", path: "/", effect: "auto" } }], errors: [] })),
      http.get("/api/config/card", () => HttpResponse.json({ items: [], errors: [] })),
    );
    renderConnect();
    await userEvent.click(screen.getByRole("tab", { name: "Advanced" }));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("Providers")).toBeInTheDocument();
    expect(within(panel).getAllByText("0 objects").length).toBeGreaterThanOrEqual(1);
    expect(within(panel).getByText("Requests")).toBeInTheDocument();
    expect(within(panel).getByText("1 object")).toBeInTheDocument();
    expect(within(panel).getByText("providers.yaml")).toBeInTheDocument();
    expect(within(panel).getByText("bad yaml")).toBeInTheDocument();
    expect(within(panel).getByText(/Worlds stores a reference to a secret/)).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /Replace/ })).not.toBeInTheDocument();
    expect(within(panel).queryByLabelText(/value/i)).not.toBeInTheDocument();
    expect(panel.querySelector("input[type='password']")).not.toBeInTheDocument();
  });
  it("Advanced: with no errors, says every config file loaded cleanly", async () => {
    server.use(
      http.get("/api/config/provider", () => HttpResponse.json({ items: [], errors: [] })),
      http.get("/api/config/request", () => HttpResponse.json({ items: [], errors: [] })),
      http.get("/api/config/card", () => HttpResponse.json({ items: [], errors: [] })),
    );
    renderConnect();
    await userEvent.click(screen.getByRole("tab", { name: "Advanced" }));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("None. Every config file loaded cleanly.")).toBeInTheDocument();
    expect(panel.querySelector("input[type='password']")).not.toBeInTheDocument();
  });
});

describe("Memory", () => {
  const renderMemory = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}><Memory /></QueryClientProvider>);
  };
  it("has the five tabs and one visible panel with a landmark heading", async () => {
    renderMemory();
    expect(tabNames()).toEqual(["Kept", "Later", "Records", "History", "Find"]);
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Memory" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Records" }));
    expect(screen.getByRole("tab", { name: "Records" })).toHaveAttribute("aria-selected", "true");
  });
  it("Records shows a locked placeholder for masked rows; each tab has its own sentence", async () => {
    renderMemory();
    const texts = new Set<string>();
    for (const name of ["Kept", "Later", "Records", "History", "Find"]) {
      await userEvent.click(screen.getByRole("tab", { name }));
      texts.add(screen.getByRole("tabpanel").textContent ?? "");
    }
    expect(texts.size).toBe(5);
    await userEvent.click(screen.getByRole("tab", { name: "Records" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/locked/i);
  });
  it("arrow keys move between tabs", async () => {
    renderMemory();
    screen.getByRole("tab", { name: "Kept" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Later" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Later" })).toHaveAttribute("aria-selected", "true");
  });
});

function Probe() {
  const { prefs } = usePrefs();
  return <output aria-label="prefs">{`${prefs.pack}|${prefs.theme}|${prefs.density}|${prefs.words}|${prefs.text}`}</output>;
}
const renderSettings = () => render(<PrefsProvider><Settings /><Probe /></PrefsProvider>);

describe("Settings", () => {
  it("puts Comfort first, then Look, Experience and Assistant", () => {
    renderSettings();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Comfort", "Look", "Experience", "Assistant"]);
  });
  it("offers each choice once, as a group named once, with no Plain theme", () => {
    renderSettings();
    const opts = (name: string) => within(screen.getByRole("group", { name })).getAllByRole("radio").map((r) => (r as HTMLInputElement).labels?.[0]?.textContent);
    expect(opts("Density")).toEqual(["Calm", "Standard", "Detailed"]);
    expect(opts("Words")).toEqual(["Minimal", "Short", "Full"]);
    expect(opts("Text size")).toEqual(["Standard", "Large", "Larger"]);
    expect(opts("Theme")).toEqual(["Starfield", "Daylight"]);
    expect(opts("Experience pack")).toEqual(["None", "Station"]);
    expect(screen.queryAllByRole("radiogroup")).toHaveLength(0);          // the legend is announced once
    expect(screen.queryByRole("radio", { name: "Plain" })).not.toBeInTheDocument();
  });
  it("describes each option in one line", () => {
    renderSettings();
    expect(screen.getByRole("radio", { name: "Calm" })).toHaveAccessibleDescription("What needs you first, quiet things folded away.");
    expect(screen.getByRole("radio", { name: "Station" })).toHaveAccessibleDescription(/never changes what Worlds says or does/);
  });
  it("defaults to None, Starfield, Standard, Short and changes preferences", async () => {
    renderSettings();
    expect(screen.getByLabelText("prefs")).toHaveTextContent("none|starfield|standard|short|standard");
    await userEvent.click(screen.getByRole("radio", { name: "Station" }));
    await userEvent.click(screen.getByRole("radio", { name: "Full" }));
    await userEvent.click(screen.getByRole("radio", { name: "Detailed" }));
    await userEvent.click(screen.getByRole("radio", { name: "Daylight" }));
    await userEvent.click(screen.getByRole("radio", { name: "Larger" }));
    expect(screen.getByLabelText("prefs")).toHaveTextContent("station|daylight|detailed|full|larger");
  });
  it("a stored Plain theme falls back to Starfield", () => {
    window.localStorage.setItem("worlds.prefs.v2", JSON.stringify({ theme: "plain" }));
    renderSettings();
    expect(screen.getByLabelText("prefs")).toHaveTextContent(/\|starfield\|/);
    window.localStorage.clear();
  });
  it("says motion follows the device and the assistant is not installed", () => {
    renderSettings();
    expect(screen.getByText(/Motion follows your device setting/)).toBeInTheDocument();
    expect(screen.getByText("Assistant")).toBeInTheDocument();
    expect(screen.getByText("Not installed")).toBeInTheDocument();
  });
});
