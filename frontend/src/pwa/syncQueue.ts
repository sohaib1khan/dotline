import { apiSend, clearCsrf, ensureCsrf } from "@/lib/api";
import { listQueuedMutations, removeQueuedMutation } from "@/pwa/offlineQueue";

let flushing = false;

export async function flushOfflineQueue(): Promise<{ synced: number; remaining: number }> {
  if (flushing || !navigator.onLine) {
    return { synced: 0, remaining: (await listQueuedMutations()).length };
  }
  flushing = true;
  let synced = 0;
  try {
    clearCsrf();
    await ensureCsrf();
    const rows = await listQueuedMutations();
    for (const row of rows) {
      if (row.id == null) continue;
      try {
        await apiSend("POST", row.path, row.body);
        await removeQueuedMutation(row.id);
        synced += 1;
      } catch {
        // Stop on first failure to preserve order / avoid CSRF storms.
        break;
      }
    }
  } finally {
    flushing = false;
  }
  return { synced, remaining: (await listQueuedMutations()).length };
}

export function startOfflineSyncWatch() {
  if (typeof window === "undefined") return () => undefined;
  const onOnline = () => {
    void flushOfflineQueue();
  };
  window.addEventListener("online", onOnline);
  if (navigator.onLine) void flushOfflineQueue();
  return () => window.removeEventListener("online", onOnline);
}
