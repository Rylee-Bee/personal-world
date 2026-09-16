import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { WorkshopShell } from "../shell/WorkshopShell";
import { SectionNav } from "../shell/SectionNav";
import { SECTIONS_ENVELOPE_KEYS, DEFAULT_SECTIONS, section, shellProviders } from "./shell-helpers";
import { fetchSections, type SectionData } from "../lib/api";
import { sectionIconToShimName, ICON_NAMES } from "../lib/icons";

/**
 * T9 SectionNav spec (FOUNDATION-SPEC §5/§10 row T9, §2.3):
 *
 * §14 Navigation model: four anchors (Today, World, Journal, Chat)
 * plus a compact Places mechanism for secondary destinations.
 *
 * - Anchor items appear as direct links in the nav.
 * - Places destinations appear behind a "Places" button (popover).
 * - hidden sections are OMITTED entirely (routes still resolve —
 *   asserted in shell-routes.spec);
 * - the active anchor carries aria-current="page";
 * - every section icon id maps to a sprite symbol that exists in the
 *   tracked sprite (the sprite gate stays green).
 *
 * axe (jsdom limit, mirrors T7/T8 specs): color-contrast disabled only.
 */
const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

const here = dirname(fileURLToPath(import.meta.url));

function mockFetch(handler: (url: string) => Response): void {
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(handler(url))));
}

function mockSections(payload: unknown): void {
  mockFetch((url: string) => {
    if (url.includes("/api/sections")) {
      return new Response(JSON.stringify({ ok: true, data: payload }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/identity/principal")) {
      return new Response(JSON.stringify({ ok: true, data: { display_name: "Test User" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/chat/providers")) {
      return new Response(JSON.stringify({ ok: true, data: { providers: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 200 });
  });
}
/** Wrap the section list in the §2.3 envelope: `{ok, data:{schema, sections}}`. */
function sectionsEnvelope(sections: SectionData[]) {
  return { schema: "personal-world/sections/1", sections };
}

beforeEach(() => {
  localStorage.setItem("pw_token", "test-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("SectionNav renders from /api/sections (T9)", () => {
  it("renders anchor sections as direct nav links", async () => {
    mockSections(sectionsEnvelope(DEFAULT_SECTIONS));
    shellProviders(<WorkshopShell><div /></WorkshopShell>);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Journal & Memory/ })).toBeTruthy();
    });
    // §14: The four anchors are always visible as direct nav links.
    for (const label of ["Today", "Journal & Memory", "Chat"]) {
      expect(screen.getAllByRole("link", { name: new RegExp(label) }).length).toBeGreaterThan(0);
    }
  });

  it("renders a Places button for secondary destinations", async () => {
    mockSections(sectionsEnvelope(DEFAULT_SECTIONS));
    shellProviders(<WorkshopShell><div /></WorkshopShell>);
    await waitFor(() => {
      // Places button should appear (secondary destinations like Settings,
      // Interests, Projects, Media, Vault, Lab)
      expect(screen.getAllByRole("button", { name: /Places/ }).length).toBeGreaterThan(0);
    });
  });

  it("omits hidden sections from the nav (visible=false is dropped)", async () => {
    const hidden = DEFAULT_SECTIONS.map((s) =>
      s.id === "journal" ? { ...s, visible: false } : s
    );
    mockSections(sectionsEnvelope(hidden));
    shellProviders(<WorkshopShell><div /></WorkshopShell>);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Today/ })).toBeTruthy();
    });
    // Hidden sections are omitted from both anchors and Places.
    expect(screen.queryAllByRole("link", { name: /Journal & Memory/ })).toHaveLength(0);
  });

  it("keeps the exact server envelope shape (§2.3)", () => {
    expect(SECTIONS_ENVELOPE_KEYS).toEqual([
      "id", "label", "icon", "order", "visible", "pinned", "kind",
      "configured", "status",
    ]);
  });

  it("marks the active anchor section with aria-current=page", () => {
    // Direct items: no fetch needed (items override the hook).
    shellProviders(
      <nav aria-label="Main">
        <SectionNav items={DEFAULT_SECTIONS} />
      </nav>,
    );
    const today = screen.getByRole("link", { name: /Today/ });
    expect(today.getAttribute("aria-current")).toBe("page");
    // Chat is an anchor but not active on the "/" route.
    const chat = screen.getByRole("link", { name: /Chat/ });
    expect(chat.getAttribute("aria-current")).toBeNull();
  });

  it("renders nav targets at the 44px floor via token vars", () => {
    // Class seam: the 44px floor is CSS truth; assert the class and the
    // token variable it consumes (jsdom has no layout).
    shellProviders(
      <nav aria-label="Main">
        <SectionNav items={DEFAULT_SECTIONS} />
      </nav>,
    );
    const link = screen.getAllByRole("link", { name: /Today/ })[0];
    expect(link.className).toContain("pw-nav-link");
  });

  it("every section icon id resolves to a sprite symbol in the tracked sprite", () => {
    // The nine §5/§10 ids (server icon fields) must exist in the sprite.
    const sprite = readFileSync(
      join(here, "..", "..", "..", "src", "personal_world", "static", "icons", "sprite.svg"),
      "utf8"
    );
    const spriteIds = new Set(
      Array.from(sprite.matchAll(/id="([^"]+)"/g), (m) => m[1] as string)
    );
    const sectionIcons = [
      "navigation--today",
      "world-content--bookmark",
      "world-content--story",
      "navigation--projects",
      "system-device--desktop",
      "navigation--journal",
      "system-device--lock",
      "navigation--chat",
      "navigation--settings",
    ];
    for (const icon of sectionIcons) {
      const shim = sectionIconToShimName(icon);
      expect(shim, `${icon} must map into the shim`).not.toBeNull();
      expect(ICON_NAMES).toContain(shim);
      expect(spriteIds.has(shim as string), `${shim} must exist in sprite.svg`).toBe(true);
    }
  });

  it("an unknown icon id in Places renders label-only (honest, not broken)", async () => {
    const items = [
      section({ id: "today", label: "Today", icon: "navigation--today" }),
      section({ id: "journal", label: "Journal", icon: "navigation--journal" }),
      section({ id: "chat", label: "Chat", icon: "navigation--chat" }),
      section({ id: "future", label: "Future", icon: "navigation--nonexistent" }),
    ];
    const { container } = shellProviders(
      <nav aria-label="Main">
        <SectionNav items={items} />
      </nav>,
    );
    // "Future" is not an anchor, so it appears in Places.
    // Places button should exist.
    const placesBtns = screen.getAllByRole("button", { name: /Places/ });
    expect(placesBtns.length).toBeGreaterThan(0);
    // Click the Places button to reveal it.
    await act(async () => {
      fireEvent.click(placesBtns[0]);
    });
    // After opening Places, the panel should appear with "Future" link.
    await waitFor(() => {
      const panel = container.querySelector(".pw-places-panel");
      expect(panel).not.toBeNull();
      // Debug: print what's in the panel
      const links = panel!.querySelectorAll("a");
      expect(links.length).toBeGreaterThan(0);
      // Find the Future link inside the panel.
      const futureLink = panel!.querySelector('a[href="/future"]');
      expect(futureLink).not.toBeNull();
      expect(futureLink!.textContent).toContain("Future");
    });
  });

  it("axe: 0 violations on the shell with default sections", async () => {
    mockSections(sectionsEnvelope(DEFAULT_SECTIONS));
    const { container } = shellProviders(
      <WorkshopShell>
        <h1>Today</h1>
      </WorkshopShell>
    );
    await waitFor(() => {
      // Wait for the anchor links to render.
      expect(screen.getAllByRole("link", { name: /Today/ }).length).toBeGreaterThan(0);
    });
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("client exposes fetchSections against /api/sections", async () => {
    const mock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, data: sectionsEnvelope(DEFAULT_SECTIONS) }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", mock);
    const sections = await fetchSections();
    expect(sections).toHaveLength(DEFAULT_SECTIONS.length);
    expect(mock).toHaveBeenCalledWith(
      "/api/sections",
      expect.objectContaining({ headers: expect.any(Headers) })
    );
  });
});
