/**
 * Book Girl (owner, 2026-09-27): a little flying book. A golden open book
 * with paper wings, sleepy-happy eyes and pink cheeks. She is drawn here as
 * one SVG with three poses:
 *
 * - "flying": wings up, a soft glow. She bobs and flaps only when the
 *   person's motion setting allows it (world.css motion tiers and the OS
 *   floor); with reduced motion she holds still and glows.
 * - "resting": landed, wings folded down against her sides.
 * - "settled": ignored, she settled down on her own: resting and faint.
 *
 * Decorative: whatever she offers is always in words beside her.
 */
export type BookGirlPose = "flying" | "resting" | "settled";

export function BookGirl({ pose = "flying", size = 44 }: { pose?: BookGirlPose; size?: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={`bookgirl bookgirl-${pose}`}
      data-pose={pose}
    >
      <circle className="bookgirl-aura" cx="24" cy="24" r="21" />
      <g className="bookgirl-flyer">
        <path
          className="bookgirl-wing-l"
          d="M17 22 C9 13, 3 16, 4 22 C6 21, 8 23, 7 26 C10 24, 13 26, 17 25 Z"
          fill="#f4ead2"
          stroke="#b98d3e"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          className="bookgirl-wing-r"
          d="M31 22 C39 13, 45 16, 44 22 C42 21, 40 23, 41 26 C38 24, 35 26, 31 25 Z"
          fill="#f4ead2"
          stroke="#b98d3e"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* The book: golden cover, cream pages, a spine down the middle. */}
        <path d="M12 18 L24 21 L36 18 L36 34 L24 37 L12 34 Z" fill="#e3b25e" stroke="#7a5320" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M14 19.5 L24 22 L34 19.5 L34 32.5 L24 35 L14 32.5 Z" fill="#fff6e3" />
        <path d="M24 22 L24 35" stroke="#b98d3e" strokeWidth="1.2" />
        {/* Sleepy-happy eyes, pink cheeks, a small smile. */}
        <path d="M17 27 q2 2 4 0 M27 27 q2 2 4 0" fill="none" stroke="#3b2a14" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="16.5" cy="30" r="1.4" fill="#f2a3a3" opacity=".85" />
        <circle cx="31.5" cy="30" r="1.4" fill="#f2a3a3" opacity=".85" />
        <path d="M22.5 31 q1.5 1.3 3 0" fill="none" stroke="#3b2a14" strokeWidth="1.1" strokeLinecap="round" />
      </g>
    </svg>
  );
}
