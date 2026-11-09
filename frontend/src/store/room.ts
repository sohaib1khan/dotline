export type RoomTrack = "braille" | "cursive";

const LAST_ROOM_KEY = "dotline.lastRoom";

export function readLastRoom(): RoomTrack | null {
  try {
    const value = localStorage.getItem(LAST_ROOM_KEY);
    if (value === "braille" || value === "cursive") return value;
  } catch {
    // ignore
  }
  return null;
}

export function writeLastRoom(track: RoomTrack): void {
  try {
    localStorage.setItem(LAST_ROOM_KEY, track);
  } catch {
    // ignore
  }
}

export function roomFromPath(pathname: string): RoomTrack | null {
  if (pathname.startsWith("/app/rooms/braille") || pathname.startsWith("/app/braille")) {
    return "braille";
  }
  if (pathname.startsWith("/app/rooms/cursive") || pathname.startsWith("/app/cursive")) {
    return "cursive";
  }
  // Shared learner pages keep the last room so nav/theme stay consistent
  if (
    pathname.startsWith("/app/games") ||
    pathname.startsWith("/app/progress") ||
    pathname.startsWith("/app/inbox") ||
    pathname.startsWith("/app/report") ||
    pathname.startsWith("/app/settings")
  ) {
    return readLastRoom();
  }
  return null;
}

export function applyRoomTheme(room: RoomTrack | null): void {
  const root = document.documentElement;
  if (room) root.dataset.room = room;
  else delete root.dataset.room;
}
