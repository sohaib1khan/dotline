import { ApiError } from "@/lib/api";
import { postGameScore } from "@/pwa/queuedPost";

export type ScoreSubmitResult = {
  score: number;
  accuracy: number | null;
  xp_awarded: number;
  leveled_up: boolean;
  level: number | null;
  high_score: number;
  new_badges: { title: string; description: string }[];
  offline_queued?: boolean;
};

export async function submitGameScore(
  gameKey: string,
  payload: { score: number; accuracy?: number; duration_s?: number },
): Promise<ScoreSubmitResult> {
  try {
    return await postGameScore<ScoreSubmitResult>(gameKey, payload, {
      score: payload.score,
      accuracy: payload.accuracy ?? null,
      xp_awarded: 0,
      leveled_up: false,
      level: null,
      high_score: payload.score,
      new_badges: [],
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(500, "Could not save score", null);
  }
}
