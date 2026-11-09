import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LessonPlayer, type LessonDetail } from "@/features/braille/LessonPlayer";
import { ApiError, apiGet } from "@/lib/api";

export function BrailleLessonPage() {
  const { lessonId } = useParams();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!lessonId) return;
    setLesson(null);
    setError("");
    void apiGet<LessonDetail>(`/api/lessons/${lessonId}`)
      .then(setLesson)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load lesson."));
  }, [lessonId]);

  return (
    <section aria-labelledby="braille-lesson-title" className="braille-lesson">
      <p className="meter">
        <Link to="/app/braille">← Braille units</Link>
      </p>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {!lesson && !error ? <p className="status">Loading lesson…</p> : null}
      {lesson ? (
        <>
          <h1 id="braille-lesson-title" className="page-title">
            {lesson.title}
          </h1>
          <p className="page-copy">
            <strong>
              {lesson.unit_title} · {lesson.type} · {lesson.xp_reward} XP
            </strong>
          </p>
          <LessonPlayer lesson={lesson} />
        </>
      ) : null}
    </section>
  );
}
