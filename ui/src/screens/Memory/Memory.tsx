/**
 * Memory — the deterministic place in the stable skeleton.
 *
 * docs/PRODUCT-LANGUAGE.md: Memory is a PLACE, not an AI feature.
 * It opens instantly with every model turned off, keeps a predictable
 * structure, supports browsing and ordinary search, and holds pinned/
 * important information as it grows. This screen is the re-cut of the
 * old standalone Journal and Records destinations into that one home:
 *
 *   Journal  — the spine (append-only entries, supersede, history)
 *   Records  — the structured-information view (memory search over
 *              the station's own source; honest empties where the
 *              backend has no door yet)
 *
 * The secrets VAULT deliberately is NOT here — it is security
 * infrastructure and lives under Settings. "Records is not the
 * friendly name for Vault." (Contract, Records vs Vault.)
 *
 * Accessibility contract: skip-to-main first, 44×44 hit areas,
 * visible focus, status by text never color alone, heading order
 * h1→h2 (§4.1), keyboard operable, native dialog semantics inside
 * the journal drawers.
 */

import { useRootAttribute } from "../../components/rooms/useRootAttribute";
import { JournalRoom } from "./JournalRoom";
import { RecordsPanel } from "./Records";

export function Memory() {
  const doorways = useRootAttribute("data-theme") === "doorways";
  return (
    <>
      {/* Skip-to-main-content — first focusable element */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-[var(--pw-radius-sm)] focus:bg-[var(--pw-surface-panel)] focus:p-[var(--pw-spacing-md)] focus:text-[var(--pw-text-primary)] focus:ring-2 focus:ring-[var(--pw-accent-teal)]"
      >
        Skip to main content
      </a>

      <main
        id="main-content"
        aria-label="Memory"
        className="mx-auto max-w-2xl space-y-[var(--pw-spacing-2xl)] p-[var(--pw-spacing-lg)]"
      >
        <header className="flex items-center gap-[var(--pw-spacing-lg)]">
          {/* Doorways theme: Memory is the archive, seen through its door
              (decorative, like the rooms' interiors). */}
          {doorways && (
            <img
              src={`${import.meta.env.BASE_URL}assets/crew/256/doorway-archive.webp`}
              alt=""
              aria-hidden="true"
              className="hidden h-28 w-auto shrink-0 object-contain sm:block"
            />
          )}
          <div className="min-w-0">
          <h1
            className="text-[length:var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]"
            style={{ fontFamily: "var(--pw-typography-font_serif, inherit)" }}
          >
            Memory
          </h1>
          <p className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            One predictable place for what this world keeps: your
            journal, your records, and the searches that find them
            without any model in the loop. Chat can recall things for
            you — it is a shortcut, never the only door.
          </p>
          </div>
        </header>

        <JournalRoom />

        <RecordsPanel />
      </main>
    </>
  );
}
