import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ApiError, apiGet } from "@/lib/api";
import { roomFromPath } from "@/store/room";

type GameInfo = {
  key: string;
  title: string;
  track: string;
  description: string;
  duration_s: number;
  unlocked: boolean;
  lock_reason: string | null;
  high_score: number;
  difficulty: number;
};

export function GamesPage() {
  const location = useLocation();
  const room = roomFromPath(location.pathname);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void apiGet<{ games: GameInfo[] }>("/api/games")
      .then((data) => setGames(data.games))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load games."));
  }, []);

  const visible = useMemo(() => {
    if (!room) return games;
    return games.filter((game) => game.track === room);
  }, [games, room]);

  return (
    <section className="braille-track" aria-labelledby="games-title">
      <h1 id="games-title" className="page-title">
        Games
      </h1>
      <p className="page-copy">
        <strong>
          {room
            ? `Showing ${room} games for this room. Pick one short round — we will guide you.`
            : "Short rounds with sound, speech, and haptics. Unlock each track’s games by finishing Unit 1."}
        </strong>
      </p>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="unit-list">
        {visible.map((game) => (
          <article key={game.key} className="unit-card" aria-labelledby={`game-${game.key}`}>
            <h2 id={`game-${game.key}`}>{game.title}</h2>
            <p>{game.description}</p>
            <p className="meter">
              <strong>{game.track}</strong> · {game.duration_s}s · best {game.high_score}
              {game.unlocked ? ` · difficulty ${game.difficulty}` : ""}
            </p>
            {game.unlocked ? (
              <Link className="primary-button link-button" to={`/app/games/${game.key}`}>
                Play
              </Link>
            ) : (
              <p className="field-error" role="status">
                <strong>{game.lock_reason}</strong>
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
