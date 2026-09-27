/**
 * The Sticker Room door: after the 12th sticker, a tiny door appears on the
 * Bridge map and opens the album. Finding it is a sticker of its own
 * ("The Other Door").
 */
import { useStickers } from "../../data/hooks";
import { reportSticker } from "./report";

export const DOOR_AFTER = 12;

export function StickerRoomDoor({ onOpen }: { onOpen: () => void }) {
  const album = useStickers();
  if ((album.data?.data?.total_found ?? 0) < DOOR_AFTER) return null;
  return (
    <button
      type="button"
      onClick={() => {
        void reportSticker("one-more-door");
        onOpen();
      }}
      className="sticker-room-door"
    >
      <img src={`${import.meta.env.BASE_URL}assets/crew/256/doorway-study.webp`} alt="" aria-hidden="true" draggable={false} />
      <span>Sticker Room</span>
    </button>
  );
}
