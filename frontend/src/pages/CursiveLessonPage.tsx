import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CursiveLessonPlayer } from "@/features/cursive/CursiveLessonPlayer";
import { ApiError, apiGet } from "@/lib/api";

type LessonDetail = {
  id: number;
  unit_title: string;
  title: string;
  type: string;
  xp_reward: number;
  content: {
    instruction?: string;
    pass_score?: number;
    studio_path?: string;
    items?: { id: string; kind: "letter" | "warmup"; key: string; label: string }[];
  };
};

export function CursiveLessonPage() {
  const { lessonId } = useParams();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!lessonId) return;
    setLesson(null);
    void apiGet<LessonDetail>(`/api/lessons/${lessonId}`)
      .then(async (data) => {
        setLesson(data);
        const { warmLessonCache } = await import("@/pwa/offlineCache");
        await warmLessonCache([`/api/lessons/${lessonId}`, "/api/cursive/strokes"]);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load lesson."));
  }, [lessonId]);

  return (
    <section className="braille-lesson" aria-labelledby="cursive-lesson-title">
      <p className="meter">
        <Link to="/app/cursive">← Cursive units</Link>
      </p>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {!lesson && !error ? <p className="status">Loading lesson…</p> : null}
      {lesson ? (
        <>
          <h1 id="cursive-lesson-title" className="page-title">
            {lesson.title}
          </h1>
          <p className="page-copy">
            <strong>
              {lesson.unit_title} · {lesson.type} · {lesson.xp_reward} XP
            </strong>
          </p>
          <CursiveLessonPlayer lesson={lesson} />
        </>
      ) : null}
    </section>
  );
}
