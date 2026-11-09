import type { UserPublic } from "@/lib/types";

/** Where a logged-in user belongs after auth — by role from the server. */
export function homePathForRole(role: string): string {
  return role === "admin" ? "/admin" : "/app";
}

export async function learnerHomePath(
  fetchTracks: () => Promise<{ tracks: string[] }>,
): Promise<string> {
  try {
    const data = await fetchTracks();
    return data.tracks.length === 0 ? "/tracks" : "/app";
  } catch {
    return "/tracks";
  }
}

export function homePathFor(user: Pick<UserPublic, "role">): string {
  return homePathForRole(user.role);
}
