import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ApiError, apiGet, apiSend } from "@/lib/api";
import type { Statusboard } from "@/lib/types";
import { writeLastRoom, type RoomTrack } from "@/store/room";
import { useAuth } from "@/store/auth";

function formatActive(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}s today`;
  return `${mins}m ${secs}s today`;
}

function isRoomTrack(value: string | undefined): value is RoomTrack {
  return value === "braille" || value === "cursive";
}

export function RoomStatusboardPage() {
  const { track: trackParam } = useParams();
  const room = isRoomTrack(trackParam) ? trackParam : null;
  const user = useAuth((s) => s.user);
  const [board, setBoard] = useState<Statusboard | null>(null);
  const [error, setError] = useState("");
  const [goalBusy, setGoalBusy] = useState(false);

  useEffect(() => {
    if (room) writeLastRoom(room);
  }, [room]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGet<Statusboard>("/api/me/statusboard");
        if (!cancelled) setBoard(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load statusboard.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!room) {
    return <Navigate to="/app" replace />;
  }

  if (board && !board.tracks.includes(room)) {
    return <Navigate to="/app" replace />;
  }

  if (board && board.tracks.length === 0) {
    return <Navigate to="/tracks" replace />;
  }

  async function setDailyGoal(minutes: 5 | 10 | 20) {
    setGoalBusy(true);
    setError("");
    try {
      await apiSend("PATCH", "/api/me/settings", { daily_goal_minutes: minutes });
      const data = await apiGet<Statusboard>("/api/me/statusboard");
      setBoard(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update daily goal.");
    } finally {
      setGoalBusy(false);
    }
  }

  const roomLabel = room === "braille" ? "Braille" : "Cursive";
  const continueTarget = board?.continue_targets.find((target) => target.track === room) ?? null;

  return (
    <section aria-labelledby="statusboard-title" className="statusboard">
      <h1 id="statusboard-title" className="page-title">
        {roomLabel} room
      </h1>
      <p className="page-copy">
        <strong>
          You’re in the {roomLabel} room
          {user ? `, ${user.first_name}` : ""}. Continue your next lesson below — one step at a time.
        </strong>
      </p>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {!board ? (
        <p className="status">Loading your progress…</p>
      ) : (
        <div className="status-grid">
          <article className="status-card" aria-labelledby="level-card-title">
            <h2 id="level-card-title">Level {board.level}</h2>
            <p>
              <strong>
                {board.xp_into_level} / {board.xp_for_next} XP
              </strong>{" "}
              toward next level · {board.total_xp} total
            </p>
            <div
              className="meter-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={board.xp_for_next}
              aria-valuenow={board.xp_into_level}
              aria-label="XP progress"
            >
              <span style={{ width: `${Math.round(board.xp_progress_ratio * 100)}%` }} />
            </div>
          </article>

          <article className="status-card" aria-labelledby="streak-card-title">
            <h2 id="streak-card-title">Streak</h2>
            <p>
              <strong>
                {board.streak_current} day{board.streak_current === 1 ? "" : "s"}
              </strong>
              {" · "}
              longest {board.streak_longest}
            </p>
            <p>
              Daily goal: <strong>{board.daily_goal_minutes} minutes</strong> ·{" "}
              {formatActive(board.today_active_seconds)}
            </p>
            <div
              className="meter-bar meter-ring"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(board.daily_goal_ratio * 100)}
              aria-label="Daily goal progress"
            >
              <span style={{ width: `${Math.round(board.daily_goal_ratio * 100)}%` }} />
            </div>
            <div className="goal-choices" role="group" aria-label="Daily goal">
              {([5, 10, 20] as const).map((mins) => (
                <button
                  key={mins}
                  type="button"
                  className={`secondary-button${board.daily_goal_minutes === mins ? " is-selected" : ""}`}
                  disabled={goalBusy}
                  aria-pressed={board.daily_goal_minutes === mins}
                  onClick={() => void setDailyGoal(mins)}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </article>

          <article className="status-card" aria-labelledby="continue-card-title">
            <h2 id="continue-card-title">Continue</h2>
            {continueTarget ? (
              <>
                <div className="continue-list">
                  <Link className="primary-button link-button" to={continueTarget.path}>
                    {continueTarget.label}
                  </Link>
                </div>
                <p className="meter">
                  <strong>{continueTarget.hint}</strong>
                </p>
              </>
            ) : (
              <p>
                <strong>Open the {roomLabel} lessons list</strong> to pick your next step.
              </p>
            )}
            <Link className="secondary-button link-button" to={`/app/${room}`}>
              Browse {roomLabel} lessons
            </Link>
          </article>

          <article className="status-card" aria-labelledby="badges-card-title">
            <h2 id="badges-card-title">Latest badges</h2>
            {board.latest_badges.length === 0 ? (
              <p>
                <strong>No badges yet.</strong> Keep practicing to earn your first.
              </p>
            ) : (
              <ul className="badge-list">
                {board.latest_badges.map((badge) => (
                  <li key={badge.key}>
                    <strong>{badge.title}</strong>
                    <span> — {badge.description}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="status-card" aria-labelledby="inbox-card-title">
            <h2 id="inbox-card-title">Inbox</h2>
            <p>
              <strong>
                {board.unread_inbox} unread
                {board.unread_inbox === 1 ? " message" : " messages"}
              </strong>
            </p>
            <Link className="secondary-button link-button" to="/app/inbox">
              Open inbox
            </Link>
          </article>
        </div>
      )}
    </section>
  );
}
