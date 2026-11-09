import { ApiError, apiPost } from "@/lib/api";

export type ScoreSubmitResult = {
  score: number;
  accuracy: number | null;
  xp_awarded: number;
  leveled_up: boolean;
  level: number | null;
  high_score: number;
  new_badges: { title: string; description: string }[];
};

export async function submitGameScore(
  gameKey: string,
  payload: { score: number; accuracy?: number; duration_s?: number },
): Promise<ScoreSubmitResult> {
  try {
    return await apiPost<ScoreSubmitResult>(`/api/games/${gameKey}/score`, payload);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(500, "Could not save score", null);
  }
}
