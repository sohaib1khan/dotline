import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, apiGet } from "@/lib/api";

type LessonSummary = {
  id: number;
  order: number;
  title: string;
  type: string;
  status: string;
  best_score: number | null;
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
  units: UnitSummary[];
  next_lesson_id: number | null;
};

function statusLabel(status: string) {
  if (status === "mastered") return "Mastered";
  if (status === "completed") return "Completed";
  if (status === "available") return "Available";
  return "Locked";
}

export function CursiveTrackPage() {
  const [data, setData] = useState<Curriculum | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void apiGet<Curriculum>("/api/lessons/track/cursive")
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load Cursive track."));
  }, []);

  return (
    <section className="braille-track" aria-labelledby="cursive-track-title">
      <h1 id="cursive-track-title" className="page-title">
        Cursive
      </h1>
      <p className="page-copy">
        <strong>Watch → Trace → Free write</strong> with 2D practice and a calm 3D guide.
      </p>
      <p className="continue-list">
        <Link className="secondary-button link-button" to="/app/cursive/signature">
          Signature Studio
        </Link>
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
              <Link className="primary-button link-button" to={`/app/cursive/lessons/${data.next_lesson_id}`}>
                Continue next lesson
              </Link>
            </p>
          ) : null}
          <div className="unit-list">
            {data.units.map((unit) => (
              <article key={unit.id} className="unit-card" aria-labelledby={`cunit-${unit.id}`}>
                <h2 id={`cunit-${unit.id}`}>
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
                          · {statusLabel(lesson.status)}
                        </span>
                      ) : lesson.type === "signature" ? (
                        <Link to="/app/cursive/signature">
                          <strong>
                            {lesson.order}. {lesson.title}
                          </strong>{" "}
                          · {statusLabel(lesson.status)}
                        </Link>
                      ) : (
                        <Link to={`/app/cursive/lessons/${lesson.id}`}>
                          <strong>
                            {lesson.order}. {lesson.title}
                          </strong>{" "}
                          · {statusLabel(lesson.status)}
                          {lesson.best_score != null ? ` · best ${Math.round(lesson.best_score)}%` : ""}
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
