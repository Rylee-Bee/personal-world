/**
 * Report a Worlds sticker the UI saw someone earn (docs/STICKERS.md: only
 * the moments the server can't see). Repeats are harmless; a new one
 * lands quietly. Never throws: a sticker is never worth an error.
 */
import { postStickerFound } from "../../data/api";
import { landed } from "./landing";

const sent = new Set<string>();

export async function reportSticker(sticker: string, context?: string): Promise<boolean> {
  if (sent.has(sticker)) return false;
  sent.add(sticker);
  try {
    const res = await postStickerFound(sticker, context);
    if (res.data?.new) {
      landed(sticker);
      return true;
    }
  } catch {
    sent.delete(sticker);
  }
  return false;
}
