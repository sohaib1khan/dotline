import { apiPost } from "@/lib/api";
import { enqueueMutation, isNetworkError } from "@/pwa/offlineQueue";

export async function postLessonComplete<T extends object>(
  lessonId: number,
  body: { score: number; correct: number; total: number },
  fallback: T,
): Promise<T & { offline_queued?: boolean }> {
  const path = `/api/lessons/${lessonId}/complete`;
  try {
    return await apiPost<T>(path, body);
  } catch (err) {
    if (!isNetworkError(err) && navigator.onLine) throw err;
    await enqueueMutation("lesson_complete", path, body);
    return { ...fallback, offline_queued: true };
  }
}

export async function postGameScore<T extends object>(
  gameKey: string,
  body: { score: number; accuracy?: number; duration_s?: number },
  fallback: T,
): Promise<T & { offline_queued?: boolean }> {
  const path = `/api/games/${gameKey}/score`;
  try {
    return await apiPost<T>(path, body);
  } catch (err) {
    if (!isNetworkError(err) && navigator.onLine) throw err;
    await enqueueMutation("game_score", path, body);
    return { ...fallback, offline_queued: true };
  }
}
