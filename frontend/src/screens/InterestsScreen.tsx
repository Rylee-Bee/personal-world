import { StatusChip } from "../primitives/StatusChip";
import { Icon } from "../lib/icons";

/**
 * InterestsScreen (Workshop v3, frame 17:1515 "Interests unexplored room",
 * emotional volume GENEROUS): the warm empty state for the Interests
 * section. The `discovery` capability is not wired in a zero-provider
 * deployment, so the screen renders the honest "not_configured" status
 * with the frame's inviting copy and decorative atmosphere.
 *
 * Composition: a radial-gradient background with scattered floating
 * motes (decorative, aria-hidden), a central discovery scene with the
 * bookmark icon (representing the frame's mermaid illustration) and
 * warm invitation text. The sidebar is the app shell's sidebar — not
 * duplicated here. The top bar carries the breadcrumb and a "Not
 * configured" status pill with the frame's glow treatment.
 *
 * Responsive: side-by-side layout ≥900px, stacked below.
 */

/** Decorative floating mote positions from the Figma frame (17:1552–17:1563).
 *  Each mote is a tiny glowing dot placed absolutely within the scene. */
const MOTES = [
  { left: "7%", top: "12.4%", size: 4 },
  { left: "16%", top: "22.9%", size: 7 },
  { left: "29%", top: "10.2%", size: 3 },
  { left: "48.4%", top: "17.6%", size: 5 },
  { left: "69.5%", top: "10.7%", size: 6 },
  { left: "87.5%", top: "20.2%", size: 3 },
  { left: "80.6%", top: "39.1%", size: 8 },
  { left: "92%", top: "56.9%", size: 4 },
  { left: "62.5%", top: "77.8%", size: 5 },
  { left: "42%", top: "88%", size: 3 },
  { left: "20.6%", top: "79.8%", size: 6 },
  { left: "7.8%", top: "62.7%", size: 3 },
] as const;

export default function InterestsScreen() {
  return (
    <section
      className="relative flex flex-col overflow-hidden"
      aria-labelledby="interests-page-heading"
      style={{
        minHeight: "calc(100vh - 76px)",
        background: "var(--pw-color-surface-canvas)",
      }}
    >
      {/* Top bar: breadcrumb + status pill */}
      <div className="flex items-center justify-between px-[42px] py-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[var(--pw-color-text-muted)]">
          <span>Rylee's world</span>
          <span aria-hidden="true">/</span>
          <span className="text-[var(--pw-color-text-secondary)]">Interests</span>
        </nav>
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3 py-[7px] text-[11px]"
          style={{
            backgroundColor: "var(--pw-color-vault-panel-translucent)",
            borderColor: "var(--pw-color-border-subtle)",
            color: "var(--pw-color-text-secondary)",
          }}
        >
          <span
            aria-hidden={true}
            className="size-[6px] rounded-full"
            style={{ backgroundColor: "var(--pw-color-text-muted)" }}
          />
          <StatusChip status="not_configured" size="sm" />
        </span>
      </div>

      {/* Discovery scene: illustration + invitation */}
      <div className="flex flex-1 flex-col items-center justify-center gap-[72px] overflow-hidden px-6 pb-[82px] min-[900px]:flex-row min-[900px]:pl-[144px] min-[900px]:pr-[120px]">
        {/* Decorative bookmark illustration area.
            The frame's mermaid explorer is design-agent art — replaced here
            with the canonical bookmark icon and atmospheric glow. */}
        <div
          aria-hidden={true}
          className="relative flex size-[280px] shrink-0 items-center justify-center"
        >
          {/* Arrival aura glow */}
          <span
            className="absolute size-[270px] rounded-full"
            style={{
              background: "var(--pw-color-warmth-aura-rose)",
            }}
          />
          {/* Bookmark icon (the frame's interests symbol) */}
          <Icon
            name="icon-world-content-bookmark"
            size={72}
            className="relative text-[var(--pw-color-accent-primary)]"
          />
          {/* Sparkle hint */}
          <span
            className="absolute right-[18px] top-[46px] select-none text-[22px] leading-none"
            style={{ color: "var(--pw-color-accent-gold)", opacity: 0.5 }}
          >
            ✦
          </span>
        </div>

        {/* Invitation text */}
        <div className="flex w-full max-w-[520px] flex-col gap-[26px]">
          {/* Room title with icon */}
          <div className="flex items-center gap-[18px]">
            <span
              className="flex size-[54px] shrink-0 items-center justify-center rounded-[14px] border"
              style={{
                backgroundColor: "var(--pw-color-warmth-teal-wash)",
                borderColor: "var(--pw-color-warmth-teal-tint)",
                boxShadow: "var(--pw-color-warmth-vault-glow)",
              }}
            >
              <Icon
                name="icon-world-content-bookmark"
                size={32}
                className="text-[var(--pw-color-accent-primary)]"
              />
            </span>
            <h1
              id="interests-page-heading"
              className="text-[40px] leading-none min-[600px]:text-[52px] min-[900px]:text-[64px]"
              style={{
                fontFamily: "var(--pw-typography-font-expressive)",
                color: "var(--pw-color-accent-primary-bright)",
              }}
            >
              Interests
            </h1>
          </div>

          {/* Warm invitation message */}
          <div className="flex flex-col gap-[14px]">
            <p
              className="text-[20px] leading-[1.25] min-[600px]:text-[27px]"
              style={{
                fontFamily: "var(--pw-typography-font-expressive)",
                color: "var(--pw-color-text-primary)",
              }}
            >
              This room is still empty.
            </p>
            <p
              className="text-[16px] min-[600px]:text-[18px]"
              style={{
                fontFamily: "var(--pw-typography-font-expressive)",
                color: "var(--pw-color-accent-secondary)",
              }}
            >
              It has been keeping the light on for you.
            </p>
            <p className="text-[15px] leading-[1.65] text-[var(--pw-color-text-secondary)]">
              Interests helps your world learn what you care about — bookmarks,
              saved articles, and things you want to explore later.
            </p>
          </div>

          {/* Explore action (not wired — honest decorative hint) */}
          <span
            className="inline-flex items-center gap-[10px] self-start py-2 text-[16px]"
            style={{ color: "var(--pw-color-accent-primary)" }}
          >
            Start exploring
            <span aria-hidden="true" className="text-[20px]">
              →
            </span>
          </span>

          {/* Divider + shelf hint */}
          <div
            className="flex items-center gap-3 overflow-hidden border-t pt-6"
            style={{ borderColor: "var(--pw-color-border-subtle)" }}
          >
            <Icon
              name="icon-actions-delete"
              size={16}
              className="shrink-0 text-[var(--pw-color-text-muted)]"
              aria-hidden={true}
            />
            <p className="whitespace-nowrap text-xs text-[var(--pw-color-text-muted)]">
              An empty shelf. What will you put here?
            </p>
          </div>
        </div>
      </div>

      {/* Floating motes: decorative atmosphere dots scattered across the scene */}
      {MOTES.map((mote, i) => (
        <span
          key={i}
          aria-hidden={true}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: mote.left,
            top: mote.top,
            width: mote.size,
            height: mote.size,
            backgroundColor: "var(--pw-color-accent-primary)",
            opacity: 0.25,
          }}
        />
      ))}

      {/* Distant doorway glow: a large translucent shape behind the scene */}
      <span
        aria-hidden={true}
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: 610,
          height: 680,
          borderRadius: "305px 305px 30px 30px",
          border: "1px solid var(--pw-color-warmth-teal-tint)",
          background: "var(--pw-color-warmth-teal-reassure)",
        }}
      />
    </section>
  );
}
