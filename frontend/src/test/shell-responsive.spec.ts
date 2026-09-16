import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Responsive cascade spec (§15):
 * - Three viewport buckets: desktop ≥900 / tablet 600–899 / phone <600
 * - env(safe-area-inset-bottom) on bottom bar (A11y §2.7)
 * - 44px targets via token var
 * - Sidebar, header, bottom bar, main all exist
 */
const here = dirname(fileURLToPath(import.meta.url));

const css = readFileSync(join(here, "..", "index.css"), "utf8");
const shellTsx = readFileSync(join(here, "..", "shell", "Shell.tsx"), "utf8");

describe("responsive cascade seams", () => {
  it("has the desktop bucket at ≥900px", () => {
    expect(css).toContain("@media (min-width: 900px)");
    expect(shellTsx).toContain('"(min-width: 900px)"');
  });

  it("has the tablet bucket at 600–899px", () => {
    // Shell.tsx uses matchMedia for viewport detection
    expect(shellTsx).toContain('"(min-width: 600px)"');
  });

  it("has the phone bucket at <600px", () => {
    expect(css).toContain("@media (max-width: 599px)");
  });

  it("bottom bar carries env(safe-area-inset-bottom) (A11y §2.7)", () => {
    expect(css).toContain("env(safe-area-inset-bottom");
  });

  it("shell layout classes exist", () => {
    expect(css).toContain(".pw-sidebar");
    expect(css).toContain(".pw-bottom-bar");
    expect(css).toContain(".pw-header");
    expect(css).toContain(".pw-main");
  });

  it("header has compact height", () => {
    expect(css).toContain("--pw-shell-header-h");
  });

  it("main fills available space", () => {
    expect(css).toMatch(/\.pw-main\s*\{[^}]*width:\s*100%/);
    expect(css).not.toMatch(/\.pw-main\s*\{[^}]*max-width/);
  });

  it("sidebar width is defined", () => {
    expect(css).toContain("--pw-shell-sidebar-w");
  });

  it("nav targets use the 44px token floor", () => {
    expect(css).toMatch(/\.pw-nav-link\s*\{[^}]*min-height:\s*var\(--pw-target-minimum\)/);
  });

  it("shell hosts assistant trigger with label", () => {
    expect(shellTsx).toContain("asAssistantTrigger");
    expect(shellTsx).toContain('title="World Assistant"');
  });

  it("sidebar has companion presence", () => {
    expect(shellTsx).toContain("pw-sidebar-companion");
    expect(shellTsx).toContain("quietly here");
  });
});
