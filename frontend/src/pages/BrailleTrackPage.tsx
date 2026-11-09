import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, apiGet } from "@/lib/api";

type LessonSummary = {
  id: number;
  order: number;
  title: string;
  type: string;
  xp_reward: number;
  status: string;
  best_score: number | null;
  attempts: number;
};

type UnitSummary = {
  id: number;
  order: number;
  title: string;
  description: string;
  unlocked: boolean;
  lessons: LessonSummary[];
};

type Curriculum = {
  track: string;
  units: UnitSummary[];
  next_lesson_id: number | null;
};

function statusLabel(status: string) {
  if (status === "mastered") return "Mastered";
  if (status === "completed") return "Completed";
  if (status === "available") return "Available";
  return "Locked";
}

export function BrailleTrackPage() {
  const [data, setData] = useState<Curriculum | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void apiGet<Curriculum>("/api/lessons/track/braille")
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load Braille track."));
  }, []);

  return (
    <section className="braille-track" aria-labelledby="braille-track-title">
      <h1 id="braille-track-title" className="page-title">
        Braille
      </h1>
      <p className="page-copy">
        <strong>English UEB Grade 1</strong> — eight units from the cell to short words.
      </p>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {!data ? (
        <p className="status">Loading units…</p>
      ) : (
        <>
          {data.next_lesson_id ? (
            <p className="continue-list">
              <Link className="primary-button link-button" to={`/app/braille/lessons/${data.next_lesson_id}`}>
                Continue next lesson
              </Link>
            </p>
          ) : (
            <p className="success-text" role="status">
              <strong>All available braille lessons complete.</strong>
            </p>
          )}
          <div className="unit-list">
            {data.units.map((unit) => (
              <article key={unit.id} className="unit-card" aria-labelledby={`unit-${unit.id}`}>
                <h2 id={`unit-${unit.id}`}>
                  Unit {unit.order}: {unit.title}
                </h2>
                <p>{unit.description}</p>
                <p className="meter">
                  <strong>{unit.unlocked ? "Unlocked" : "Locked"}</strong>
                </p>
                <ul className="lesson-list">
                  {unit.lessons.map((lesson) => (
                    <li key={lesson.id}>
                      {lesson.status === "locked" ? (
                        <span>
                          <strong>
                            {lesson.order}. {lesson.title}
                          </strong>{" "}
                          · {statusLabel(lesson.status)} · {lesson.type}
                        </span>
                      ) : (
                        <Link className="progress-lesson-link" to={`/app/braille/lessons/${lesson.id}`}>
                          <strong>
                            {lesson.order}. {lesson.title}
                          </strong>{" "}
                          · {statusLabel(lesson.status)} · {lesson.type}
                          {lesson.best_score != null ? ` · best ${Math.round(lesson.best_score)}%` : ""}
                          {lesson.status === "mastered" || lesson.status === "completed"
                            ? " · Replay"
                            : ""}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
