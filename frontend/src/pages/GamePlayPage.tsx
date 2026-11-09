import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CellMatchGame } from "@/features/games/CellMatchGame";
import { DotDropGame } from "@/features/games/DotDropGame";
import { LanternPathGame } from "@/features/games/LanternPathGame";
import { WordWeaverGame } from "@/features/games/WordWeaverGame";
import { ApiError, apiGet } from "@/lib/api";

type GameInfo = {
  key: string;
  title: string;
  duration_s: number;
  unlocked: boolean;
  lock_reason: string | null;
  high_score: number;
  difficulty: number;
};

export function GamePlayPage() {
  const { gameKey } = useParams();
  const [game, setGame] = useState<GameInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!gameKey) return;
    void apiGet<GameInfo>(`/api/games/${gameKey}`)
      .then(setGame)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load game."));
  }, [gameKey]);

  if (error) {
    return (
      <section>
        <p className="field-error" role="alert">
          {error}
        </p>
        <Link to="/app/games">Back to games</Link>
      </section>
    );
  }

  if (!game) return <p className="status">Loading game…</p>;

  if (!game.unlocked) {
    return (
      <section>
        <h1 className="page-title">{game.title}</h1>
        <p className="field-error" role="status">
          <strong>{game.lock_reason}</strong>
        </p>
        <Link className="secondary-button link-button" to="/app/games">
          Back to games
        </Link>
      </section>
    );
  }

  const props = {
    difficulty: game.difficulty,
    durationS: game.duration_s,
    highScore: game.high_score,
  };

  return (
    <div className="game-play">
      <p className="meter">
        <Link to="/app/games">← Games</Link>
      </p>
      {game.key === "dot_drop" ? <DotDropGame {...props} /> : null}
      {game.key === "cell_match" ? <CellMatchGame {...props} /> : null}
      {game.key === "lantern_path" ? <LanternPathGame {...props} /> : null}
      {game.key === "word_weaver" ? <WordWeaverGame {...props} /> : null}
    </div>
  );
}
