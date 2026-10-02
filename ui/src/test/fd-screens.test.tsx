import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Connect } from "../fd/Connect";
import { Memory } from "../fd/Memory";
import { PrefsProvider } from "../fd/prefs";
import { usePrefs } from "../fd/prefs-core";
import { Settings } from "../fd/Settings";

afterEach(cleanup);

const tabNames = () => screen.getAllByRole("tab").map((t) => t.textContent);

describe("Connect", () => {
  it("has the five tabs and one panel", async () => {
    render(<Connect />);
    expect(tabNames()).toEqual(["Requests", "Providers", "Recipes", "Actions", "Advanced"]);
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    await userEvent.click(screen.getByRole("tab", { name: "Actions" }));
    expect(screen.getByRole("tab", { name: "Actions" })).toHaveAttribute("aria-selected", "true");
  });
  it("each empty tab has its own sentence", async () => {
    render(<Connect />);
    const texts = new Set<string>();
    for (const name of ["Requests", "Providers", "Recipes"]) {
      await userEvent.click(screen.getByRole("tab", { name }));
      texts.add(screen.getByRole("tabpanel").textContent ?? "");
    }
    expect(texts.size).toBe(3);
  });
  it("Actions: a write asks first in a modal dialog, safe choice first and focused, then shows a receipt", async () => {
    render(<Connect />);
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
    render(<Connect />);
    await userEvent.click(screen.getByRole("tab", { name: "Actions" }));
    await userEvent.click(screen.getByRole("button", { name: "Run: Start a backup" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Start a backup" }));
    expect(screen.getByRole("status")).toHaveTextContent("Unknown: the result was not confirmed");
  });
  it("Advanced: secret names with set or not set, write-only replace, never a value", async () => {
    render(<Connect />);
    await userEvent.click(screen.getByRole("tab", { name: "Advanced" }));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("PW_SONARR_TOKEN")).toBeInTheDocument();
    expect(within(panel).getAllByText("Set")).toHaveLength(1);
    expect(within(panel).getAllByText("Not set")).toHaveLength(1);
    await userEvent.click(within(panel).getByRole("button", { name: "Replace PW_SONARR_TOKEN" }));
    const input = within(panel).getByLabelText("New value for PW_SONARR_TOKEN");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("autocomplete", "off");
  });
  it("Replace focuses the field; Save says Saved and returns focus; Cancel returns focus", async () => {
    render(<Connect />);
    await userEvent.click(screen.getByRole("tab", { name: "Advanced" }));
    const replace = () => screen.getByRole("button", { name: "Replace PW_SONARR_TOKEN" });
    await userEvent.click(replace());
    expect(screen.getByLabelText("New value for PW_SONARR_TOKEN")).toHaveFocus();
    await userEvent.type(screen.getByLabelText("New value for PW_SONARR_TOKEN"), "hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(replace()).toHaveFocus();
    expect(screen.getAllByRole("status").map((s) => s.textContent)).toContain("Saved");
    expect(document.body).not.toHaveTextContent("hunter2");
    await userEvent.click(replace());
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(replace()).toHaveFocus();
    expect(screen.getAllByRole("status").map((s) => s.textContent)).not.toContain("Saved");
  });
});

describe("Memory", () => {
  it("has the five tabs and no control that does nothing", async () => {
    render(<Memory />);
    expect(tabNames()).toEqual(["Kept", "Later", "Records", "History", "Find"]);
    for (const name of ["Kept", "Later", "Records", "History", "Find"]) {
      await userEvent.click(screen.getByRole("tab", { name }));
      const panel = screen.getByRole("tabpanel");
      expect(within(panel).queryAllByRole("button")).toHaveLength(0);
      expect(within(panel).queryAllByRole("searchbox")).toHaveLength(0);
      expect(panel.textContent?.trim().length).toBeGreaterThan(10);
    }
  });
  it("Records says it is locked; each tab has its own sentence", async () => {
    render(<Memory />);
    const texts = new Set<string>();
    for (const name of ["Kept", "Later", "Records", "History", "Find"]) {
      await userEvent.click(screen.getByRole("tab", { name }));
      texts.add(screen.getByRole("tabpanel").textContent ?? "");
    }
    expect(texts.size).toBe(5);
    await userEvent.click(screen.getByRole("tab", { name: "Records" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/locked/);
  });
  it("arrow keys move between tabs", async () => {
    render(<Memory />);
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
