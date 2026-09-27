/**
 * The quiet landing, mounted once in the app: the newest sticker that
 * landed peels into the corner (unless it's a quiet time), and a press
 * opens the album. It's already in the album either way.
 */
import { useEffect } from "react";
import { useStickers } from "../../data/hooks";
import { StickerPeel } from "./StickerPeel";
import { dismissLanded, useLanded, useStickerMuted } from "./landing";
import { stickerArt } from "./art";

export function StickerLanding({ roughNightOpen, onOpenAlbum }: { roughNightOpen: boolean; onOpenAlbum: () => void }) {
  const queue = useLanded();
  const muted = useStickerMuted({ roughNightOpen });
  const album = useStickers(queue.length > 0);
  const id = queue[queue.length - 1];
  // A sticker just landed: read the album again so it's there to show.
  const { refetch } = album;
  useEffect(() => {
    if (id) void refetch();
  }, [id, refetch]);
  if (!id) return null;
  const s = album.data?.data?.pages.find((p) => p.app === "worlds")?.stickers.find((x) => x.id === id);
  if (!s || !s.found) return null;
  return (
    <StickerPeel
      key={id}
      id={id}
      name={s.name ?? "A secret"}
      shine={s.shine}
      art={stickerArt("worlds", s)}
      muted={muted}
      onOpen={() => {
        dismissLanded(id);
        onOpenAlbum();
      }}
    />
  );
}
