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

/** Ask the Rooms panel to open a room's drawer from outside it (e.g. the
 *  Bridge's Needs-you tray, whose item belongs to a room, not a system). */
export const OPEN_ROOM_EVENT = "pw-open-room";

export interface OpenRoomDetail {
  roomId: string;
  opener: HTMLElement | null;
}

export function requestOpenRoom(roomId: string, opener: HTMLElement | null): void {
  window.dispatchEvent(new CustomEvent<OpenRoomDetail>(OPEN_ROOM_EVENT, { detail: { roomId, opener } }));
}
