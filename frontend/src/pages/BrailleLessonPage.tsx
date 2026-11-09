import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BrandMark } from "@/components/BrandMark";
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
      .then(async (data) => {
        setLesson(data);
        const { warmLessonCache } = await import("@/pwa/offlineCache");
        await warmLessonCache([`/api/lessons/${lessonId}`]);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load lesson."));
  }, [lessonId]);

  return (
    <section aria-labelledby="braille-lesson-title" className="braille-lesson">
      <div className="lesson-topbar">
        <BrandMark to="/app" className="lesson-home-mark" />
        <p className="meter">
          <Link to="/app/braille">← Braille units</Link>
        </p>
      </div>
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
