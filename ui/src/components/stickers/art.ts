import { roomArtUrl } from "../../data/api";
import type { AlbumSticker } from "../../data/api";
import { artName } from "../rooms/choices";

/** A sticker's picture: Worlds' own under /assets/stickers, another app's
 *  through its room's art (so it shows without signing in there). */
export function stickerArt(app: string, s: Pick<AlbumSticker, "id" | "art">): string | null {
  const art = s.art ?? (app === "worlds" ? `/assets/stickers/${s.id}.webp` : null);
  if (!art) return null;
  if (app === "worlds") {
    const path = art.startsWith("/") ? art : `/assets/stickers/${art}.webp`;
    return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
  }
  const name = artName(art.endsWith(".webp") ? art : `${art}.webp`);
  return name ? roomArtUrl(app, name) : null;
}
