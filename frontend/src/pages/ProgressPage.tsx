import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Field } from "@/components/AuthForm";
import { ApiError, apiGet, apiPost } from "@/lib/api";

type UnitProgress = {
  id: number;
  order: number;
  title: string;
  unlocked: boolean;
  lessons: {
    id: number;
    order: number;
    title: string;
    type: string;
    status: string;
    best_score: number | null;
  }[];
};

type ProgressPayload = {
  total_xp: number;
  level: number;
  xp_into_level: number;
  xp_for_next: number;
  badges_earned: number;
  total_active_seconds: number;
  game_high_scores: { game_key: string; title: string; track: string; high_score: number }[];
  tracks: Record<string, { units: UnitProgress[]; next_lesson_id: number | null }>;
};

type ResetScope = "braille" | "cursive" | "everything";

function formatActive(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  return `${mins}m`;
}

export function ProgressPage() {
  const [data, setData] = useState<ProgressPayload | null>(null);
  const [error, setError] = useState("");
  const [scope, setScope] = useState<ResetScope>("braille");
  const [confirm, setConfirm] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setData(await apiGet<ProgressPayload>("/api/me/progress"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load progress.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onReset() {
    setBusy(true);
    setError("");
    setResetMessage("");
    try {
      const result = await apiPost<{ progress: ProgressPayload; removed: Record<string, number> }>(
        "/api/me/progress/reset",
        { scope, confirm },
      );
      setData(result.progress);
      setConfirm("");
      setResetMessage(
        `Reset ${scope}. Removed ${result.removed.lesson_progress} lesson rows, ${result.removed.xp_events} XP events.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="braille-track" aria-labelledby="progress-title">
      <h1 id="progress-title" className="page-title">
        Progress
      </h1>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {!data ? (
        <p className="status">Loading progress…</p>
      ) : (
        <>
          <div className="status-grid">
            <article className="status-card">
              <h2>Totals</h2>
              <p>
                <strong>
                  Level {data.level} · {data.total_xp} XP
                </strong>
              </p>
              <p>
                {data.xp_into_level}/{data.xp_for_next} to next · {data.badges_earned} badges ·{" "}
                {formatActive(data.total_active_seconds)} active
              </p>
            </article>
            <article className="status-card">
              <h2>Game highs</h2>
              <ul className="lesson-list">
                {data.game_high_scores.map((game) => (
                  <li key={game.game_key}>
                    <strong>{game.title}</strong> · {game.high_score}
                  </li>
                ))}
              </ul>
            </article>
          </div>

          {(["braille", "cursive"] as const).map((track) => {
            const trackData = data.tracks[track];
            if (!trackData?.units?.length) {
              return (
                <article key={track} className="unit-card">
                  <h2>{track === "braille" ? "Braille" : "Cursive"}</h2>
                  <p>
                    <strong>Not enrolled.</strong>{" "}
                    <Link to="/tracks">Pick tracks</Link>
                  </p>
                </article>
              );
            }
            return (
              <div key={track} className="unit-list">
                <h2 className="page-title">{track === "braille" ? "Braille" : "Cursive"}</h2>
                {trackData.units.map((unit) => (
                  <article key={unit.id} className="unit-card">
                    <h3>
                      Unit {unit.order}: {unit.title}
                    </h3>
                    <p className="meter">
                      <strong>{unit.unlocked ? "Unlocked" : "Locked"}</strong>
                    </p>
                    <ul className="lesson-list">
                      {unit.lessons.map((lesson) => (
                        <li key={lesson.id}>
                          <strong>
                            {lesson.order}. {lesson.title}
                          </strong>{" "}
                          · {lesson.status}
                          {lesson.best_score != null ? ` · best ${Math.round(lesson.best_score)}%` : ""}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            );
          })}

          <article className="unit-card" aria-labelledby="reset-title">
            <h2 id="reset-title">Reset progress</h2>
            <p className="page-copy">
              <strong>Account and settings stay.</strong> Track XP, badges, lesson progress, and
              game scores for the chosen scope are removed. Type RESET to confirm.
            </p>
            <div className="goal-choices" role="radiogroup" aria-label="Reset scope">
              {(["braille", "cursive", "everything"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`secondary-button${scope === option ? " is-selected" : ""}`}
                  aria-pressed={scope === option}
                  onClick={() => setScope(option)}
                >
                  {option === "everything" ? "Everything" : option === "braille" ? "Braille only" : "Cursive only"}
                </button>
              ))}
            </div>
            <Field id="reset-confirm" label="Type RESET" value={confirm} onChange={setConfirm} />
            {resetMessage ? (
              <p className="success-text" role="status">
                {resetMessage}
              </p>
            ) : null}
            <button
              className="primary-button"
              type="button"
              disabled={busy || confirm.trim().toUpperCase() !== "RESET"}
              onClick={() => void onReset()}
            >
              {busy ? "Resetting…" : "Reset progress"}
            </button>
          </article>
        </>
      )}
    </section>
  );
}
