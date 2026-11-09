import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CelebrationOverlay, type CelebrationPayload } from "@/components/CelebrationOverlay";
import { sampleGlyph, scoreAgainstGuide, type GlyphDef, type Point } from "@/features/cursive/geometry";
import { TraceScene3D } from "@/features/cursive/TraceScene3D";
import type { TraceMode } from "@/features/cursive/TraceCanvas";
import { feedback } from "@/feedback";
import { ApiError, apiGet } from "@/lib/api";
import { postLessonComplete } from "@/pwa/queuedPost";
import { usePreferences } from "@/store/preferences";

type LessonItem = {
  id: string;
  kind: "letter" | "warmup";
  key: string;
  label: string;
};

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
    items?: LessonItem[];
  };
};

type StrokesPayload = {
  warmups: Record<string, GlyphDef>;
  letters: Record<string, GlyphDef>;
};

type CompleteResult = {
  passed: boolean;
  pass_score: number;
  score: number;
  correct: number;
  total: number;
  xp_awarded: number;
  leveled_up: boolean;
  level: number | null;
  new_badges: { title: string; description: string }[];
  next_lesson_id: number | null;
};

const STAGE_ORDER: TraceMode[] = ["watch", "trace", "free"];

export function CursiveLessonPlayer({ lesson }: { lesson: LessonDetail }) {
  const handedness = usePreferences((s) => s.settings.handedness);
  const items = useMemo(() => lesson.content.items ?? [], [lesson.content.items]);
  const [strokesLib, setStrokesLib] = useState<StrokesPayload | null>(null);
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<TraceMode>("watch");
  const [scores, setScores] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState<CompleteResult | null>(null);
  const [error, setError] = useState("");
  const [celebration, setCelebration] = useState<CelebrationPayload | null>(null);
  const [pending, setPending] = useState<CelebrationPayload[]>([]);
  const [glow, setGlow] = useState(false);

  useEffect(() => {
    void apiGet<StrokesPayload>("/api/cursive/strokes")
      .then(setStrokesLib)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load strokes."));
  }, []);

  useEffect(() => {
    setIndex(0);
    setStage(lesson.type === "review" ? "trace" : "watch");
    setScores([]);
    setDone(null);
    setMessage("");
  }, [lesson.id, lesson.type]);

  const current = items[index] ?? null;
  const glyph = useMemo(() => {
    if (!strokesLib || !current) return null;
    if (current.kind === "warmup") return strokesLib.warmups[current.key] ?? null;
    return strokesLib.letters[current.key] ?? null;
  }, [strokesLib, current]);

  useEffect(() => {
    if (!glyph || !current) return;
    feedback.speak(glyph.speak || current.label);
  }, [glyph, current, stage, index]);

  function nextAfterPass(score: number) {
    const nextScores = [...scores, score];
    if (lesson.type !== "review" && stage !== "free") {
      const stageIndex = STAGE_ORDER.indexOf(stage);
      setStage(STAGE_ORDER[stageIndex + 1] ?? "free");
      setMessage("");
      return;
    }
    setScores(nextScores);
    if (index + 1 >= items.length) {
      void finish(nextScores);
      return;
    }
    setIndex((value) => value + 1);
    setStage(lesson.type === "review" ? "trace" : "watch");
    setMessage("");
  }

  function onStrokeEnd(points: Point[]) {
    if (!glyph || stage === "watch") return;
    const guide = sampleGlyph(glyph.strokes);
    const result = scoreAgainstGuide(points, guide);
    setMessage(result.feedback);
    if (result.score >= 55) {
      feedback.correct(result.feedback);
      nextAfterPass(result.score);
    } else {
      feedback.wrong(result.feedback);
    }
  }

  async function finish(finalScores: number[]) {
    const total = Math.max(1, finalScores.length);
    const avg = Math.round(finalScores.reduce((a, b) => a + b, 0) / total);
    const correct = finalScores.filter((s) => s >= 55).length;
    try {
      const passScore = lesson.content.pass_score ?? 70;
      const result = await postLessonComplete<CompleteResult>(
        lesson.id,
        { score: avg, correct, total },
        {
          passed: avg >= passScore,
          pass_score: passScore,
          score: avg,
          correct,
          total,
          xp_awarded: 0,
          leveled_up: false,
          level: null,
          new_badges: [],
          next_lesson_id: null,
        },
      );
      setDone(result);
      const queue: CelebrationPayload[] = [];
      if (result.leveled_up && result.level) {
        queue.push({
          kind: "level_up",
          title: `Level ${result.level}`,
          detail: `+${result.xp_awarded} XP`,
        });
      }
      for (const badge of result.new_badges) {
        queue.push({ kind: "badge", title: badge.title, detail: badge.description });
      }
      if (queue.length) {
        setCelebration(queue[0] ?? null);
        setPending(queue.slice(1));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save progress.");
    }
  }

  if (lesson.type === "signature") {
    return (
      <div className="banner" role="status">
        <strong>Signature Studio</strong>
        <p>Practice and save your signature in the studio.</p>
        <Link className="primary-button link-button" to="/app/cursive/signature">
          Open Signature Studio
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <section className="lesson-result">
        <h2 className="page-title">{done.passed ? "Lesson passed" : "Keep practicing"}</h2>
        <p className="page-copy">
          <strong>
            Score {done.score}% · +{done.xp_awarded} XP
          </strong>
        </p>
        <div className="continue-list">
          {done.next_lesson_id ? (
            <Link className="primary-button link-button" to={`/app/cursive/lessons/${done.next_lesson_id}`}>
              Next lesson
            </Link>
          ) : null}
          <Link className="secondary-button link-button" to="/app/cursive">
            Back to Cursive units
          </Link>
        </div>
        <CelebrationOverlay
          payload={celebration}
          onDismiss={() => {
            if (pending.length) {
              setCelebration(pending[0] ?? null);
              setPending(pending.slice(1));
            } else setCelebration(null);
          }}
        />
      </section>
    );
  }

  if (!strokesLib || !current || !glyph) {
    return <p className="status">{error || "Loading stroke library…"}</p>;
  }

  return (
    <section className="lesson-player" aria-labelledby="cursive-item-title">
      <p className="meter">
        <strong>
          {current.label} · stage {stage}
        </strong>{" "}
        · item {index + 1}/{items.length}
      </p>
      <h2 id="cursive-item-title" className="page-title">
        {current.label}
      </h2>
      <p className="page-copy">
        <strong>{lesson.content.instruction}</strong>
      </p>
      <p className="meter">
        {stage === "watch"
          ? "Watch the ghost pen, then continue."
          : stage === "trace"
            ? "Trace the glowing guide."
            : "Free write — faint guide only."}
      </p>
      <div className={`trace-wrap${glow ? " is-offpath" : ""}`}>
        <TraceScene3D
          strokes={glyph.strokes}
          mode={stage}
          mirror={handedness === "left"}
          watchKey={`${current.id}-${stage}`}
          onOffPath={() => {
            setGlow(true);
            window.setTimeout(() => setGlow(false), 220);
          }}
          onStrokeEnd={onStrokeEnd}
        />
      </div>
      {stage === "watch" ? (
        <button className="primary-button" type="button" onClick={() => setStage("trace")}>
          I’m ready to trace
        </button>
      ) : null}
      {message ? (
        <p className={message.startsWith("Nice") || message.includes("Nice") ? "success-text" : "field-error"} role="status">
          <strong>{message}</strong>
        </p>
      ) : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
