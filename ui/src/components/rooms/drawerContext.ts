/**
 * How a row asks the Rooms panel to open its drawer. The panel owns the
 * open room and remembers which control opened it, so closing returns
 * focus there.
 */
import { createContext, useContext } from "react";

export interface RoomDrawerControl {
  openRoomId: string | null;
  open: (roomId: string, opener: HTMLElement) => void;
}

export const RoomDrawerContext = createContext<RoomDrawerControl>({
  openRoomId: null,
  open: () => {},
});

export function useRoomDrawer(): RoomDrawerControl {
  return useContext(RoomDrawerContext);
}
