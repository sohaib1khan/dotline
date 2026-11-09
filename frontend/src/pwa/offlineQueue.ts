/** IndexedDB queue for offline lesson/game progress sync. */

const DB_NAME = "dotline-offline";
const STORE = "queue";
const DB_VERSION = 1;

export type QueuedMutation = {
  id?: number;
  path: string;
  body: unknown;
  created_at: string;
  kind: "lesson_complete" | "game_score";
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

export async function enqueueMutation(
  kind: QueuedMutation["kind"],
  path: string,
  body: unknown,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({
      kind,
      path,
      body,
      created_at: new Date().toISOString(),
    } satisfies Omit<QueuedMutation, "id">);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Queue write failed"));
  });
  db.close();
}

export async function listQueuedMutations(): Promise<QueuedMutation[]> {
  const db = await openDb();
  const rows = await new Promise<QueuedMutation[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as QueuedMutation[]) || []);
    req.onerror = () => reject(req.error ?? new Error("Queue read failed"));
  });
  db.close();
  return rows;
}

export async function removeQueuedMutation(id: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Queue delete failed"));
  });
  db.close();
}

export async function queuedCount(): Promise<number> {
  return (await listQueuedMutations()).length;
}

export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof Error && /failed to fetch|networkerror|offline/i.test(err.message)) {
    return true;
  }
  return typeof navigator !== "undefined" && !navigator.onLine;
}
