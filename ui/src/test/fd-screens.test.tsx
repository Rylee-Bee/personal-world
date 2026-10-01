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
  it("Actions: lists bindings; a write asks first and then shows a receipt", async () => {
    render(<Connect />);
    await userEvent.click(screen.getByRole("tab", { name: "Actions" }));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("Read Sonarr queue")).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /Run: Read Sonarr queue/ })).not.toBeInTheDocument();
    const run = within(panel).getByRole("button", { name: "Run: Restart Sonarr" });
    await userEvent.click(run);
    const dlg = screen.getByRole("dialog", { name: /Restart Sonarr/ });
    expect(dlg).toHaveAttribute("aria-modal", "true");
    expect(within(dlg).getByText("Sample, nothing was sent.")).toBeInTheDocument();
    expect(screen.queryByText("SUCCEEDED")).not.toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(run).toHaveFocus();
    await userEvent.click(run);
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm" }));
    expect(screen.getByRole("status")).toHaveTextContent("SUCCEEDED");
    expect(screen.getByRole("status")).toHaveTextContent("Sample, nothing was sent.");
    expect(run).toHaveFocus();
    expect(screen.getByText("Sample data")).toBeInTheDocument();
  });
  it("B7: the dialog traps focus in both directions", async () => {
    render(<Connect />);
    await userEvent.click(screen.getByRole("tab", { name: "Actions" }));
    await userEvent.click(screen.getByRole("button", { name: "Run: Restart Sonarr" }));
    const dlg = screen.getByRole("dialog");
    const confirm = within(dlg).getByRole("button", { name: "Confirm" });
    const cancel = within(dlg).getByRole("button", { name: "Cancel" });
    confirm.focus();
    await userEvent.tab();
    expect(cancel).toHaveFocus();
    await userEvent.tab();
    expect(confirm).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(cancel).toHaveFocus();
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
});

describe("Memory", () => {
  it("has the five tabs; Records is locked until you confirm it's you", async () => {
    render(<Memory />);
    expect(tabNames()).toEqual(["Kept", "Later", "Records", "History", "Find"]);
    await userEvent.click(screen.getByRole("tab", { name: "Records" }));
    expect(within(screen.getByRole("tabpanel")).getByRole("button", { name: "Confirm it's you" })).toBeInTheDocument();
  });
  it("arrow keys move between tabs", async () => {
    render(<Memory />);
    screen.getByRole("tab", { name: "Kept" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Later" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Later" })).toHaveAttribute("aria-selected", "true");
  });
  it("Find has a labelled search", async () => {
    render(<Memory />);
    await userEvent.click(screen.getByRole("tab", { name: "Find" }));
    expect(screen.getByRole("searchbox", { name: "Search Memory" })).toBeInTheDocument();
  });
});

function Probe() {
  const { prefs } = usePrefs();
  return <output aria-label="prefs">{`${prefs.pack}|${prefs.theme}|${prefs.density}|${prefs.words}`}</output>;
}
const renderSettings = () => render(<PrefsProvider><Settings /><Probe /></PrefsProvider>);

describe("Settings", () => {
  it("offers pack, theme, density, Words as radio groups with the right options", () => {
    renderSettings();
    const opts = (name: string) => within(screen.getByRole("radiogroup", { name })).getAllByRole("radio").map((r) => (r as HTMLInputElement).labels?.[0]?.textContent);
    expect(opts("Experience pack")).toEqual(["None", "Station"]);
    expect(opts("Theme")).toEqual(["Starfield", "Daylight", "Plain"]);
    expect(opts("Density")).toEqual(["Calm", "Standard", "Detailed"]);
    expect(opts("Words")).toEqual(["Minimal", "Short", "Full"]);
  });
  it("defaults to None, Starfield, Standard, Short and changes preferences", async () => {
    renderSettings();
    expect(screen.getByLabelText("prefs")).toHaveTextContent("none|starfield|standard|short");
    await userEvent.click(screen.getByRole("radio", { name: "Station" }));
    await userEvent.click(screen.getByRole("radio", { name: "Full" }));
    await userEvent.click(screen.getByRole("radio", { name: "Detailed" }));
    await userEvent.click(screen.getByRole("radio", { name: "Daylight" }));
    expect(screen.getByLabelText("prefs")).toHaveTextContent("station|daylight|detailed|full");
  });
  it("says motion follows the device and the assistant is not installed", () => {
    renderSettings();
    expect(screen.getByText(/Motion follows your device setting/)).toBeInTheDocument();
    expect(screen.getByText("Assistant")).toBeInTheDocument();
    expect(screen.getByText("Not installed")).toBeInTheDocument();
  });
});
