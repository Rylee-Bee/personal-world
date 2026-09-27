/**
 * A sticker lands quietly (the Sticker Album's rule): a small sticker peels
 * into the corner, like Book Girl's glow. No sound, no popup, no push.
 * Tapped, it opens the album at that sticker; ignored, it settles and
 * fades out after a while, and nothing is lost (it's already in the album).
 * `muted` (dim mode, Rough night) shows nothing at all.
 */
import { useEffect, useState } from "react";
import { Sticker, type StickerShine } from "./Sticker";

export const PEEL_SETTLE_MS = 10_000;

export function StickerPeel({
  id,
  name,
  shine,
  art,
  muted = false,
  onOpen,
}: {
  id: string;
  name: string;
  shine: StickerShine;
  art?: string | null;
  muted?: boolean;
  onOpen?: () => void;
}) {
  const [settled, setSettled] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (muted) return;
    const a = setTimeout(() => setSettled(true), PEEL_SETTLE_MS);
    const b = setTimeout(() => setGone(true), PEEL_SETTLE_MS * 2);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [muted]);
  if (muted || gone) return null;
  return (
    <aside aria-label="New sticker" className={`sticker-peel ${settled ? "sticker-peel-settled" : ""}`}>
      <p className="sticker-peel-words">{`New sticker: ${name}`}</p>
      <Sticker id={id} name={name} kind="open" shine={shine} art={art} found size={56} onTurnOver={onOpen} />
    </aside>
  );
}
