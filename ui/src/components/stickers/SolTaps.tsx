/**
 * The header's Sol mark. It's just the logo, except that seven taps in a
 * row make Sol wave back (a secret sticker: "Sol Says Hi"). Voiceless as
 * ever: the only words are the logo's own name.
 */
import { useRef, useState } from "react";
import { SolMoment } from "../SolMoment";
import { reportSticker } from "./report";

export function SolTaps() {
  const [waving, setWaving] = useState(false);
  const taps = useRef<number[]>([]);
  return (
    <button
      type="button"
      aria-label="Worlds"
      onClick={() => {
        const now = Date.now();
        taps.current = [...taps.current.filter((t) => now - t < 4000), now];
        if (taps.current.length >= 7) {
          taps.current = [];
          setWaving(true);
          void reportSticker("sol-hi");
          setTimeout(() => setWaving(false), 2500);
        }
      }}
      className="grid min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] place-items-center rounded-full border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]"
    >
      <SolMoment mood={waving ? "hello" : "mark"} size={36} />
    </button>
  );
}
