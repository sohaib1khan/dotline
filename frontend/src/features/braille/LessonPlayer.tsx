import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TouchBraillePad } from "@/components/TouchBraillePad";
import { PerkinsKeyboard } from "@/components/PerkinsKeyboard";
import { CelebrationOverlay, type CelebrationPayload } from "@/components/CelebrationOverlay";
import { BrailleCell } from "@/features/braille/BrailleCell";
import { feedback } from "@/feedback";
import { subscribeInput } from "@/input";
import { ApiError } from "@/lib/api";
import { postLessonComplete } from "@/pwa/queuedPost";

export type LessonItem = {
  id: string;
  label: string;
  speak?: string;
  letter?: string;
  dots: number[];
  show_cell?: boolean;
  choices?: string[];
  answer?: string;
  kind?: "write" | "read" | "learn";
  note?: string;
};

export type LessonDetail = {
  id: number;
  unit_title: string;
  title: string;
  type: string;
  xp_reward: number;
  content: {
    instruction?: string;
    pass_score?: number;
    passage?: string;
    passage_speak?: string;
    items?: LessonItem[];
  };
};

type CompleteResult = {
  passed: boolean;
  pass_score: number;
  score: number;
  correct: number;
  total: number;
  status: string;
  xp_awarded: number;
  leveled_up: boolean;
  level: number | null;
  new_badges: { key: string; title: string; description: string }[];
  next_lesson_id: number | null;
};

function sameDots(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  const left = [...a].sort((x, y) => x - y);
  const right = [...b].sort((x, y) => x - y);
  return left.every((value, index) => value === right[index]);
}

function itemMode(lessonType: string, item: LessonItem): "chord" | "choice" {
  const kind = item.kind ?? (lessonType === "review" ? "write" : lessonType);
  if (kind === "read" || (item.choices && item.choices.length > 0 && item.answer)) {
    return "choice";
  }
  return "chord";
}

type Props = {
  lesson: LessonDetail;
};

export function LessonPlayer({ lesson }: Props) {
  const items = useMemo(() => lesson.content.items ?? [], [lesson.content.items]);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle");
  const [message, setMessage] = useState("");
  const [touchMode, setTouchMode] = useState<"chord" | "single">("chord");
  const [done, setDone] = useState<CompleteResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [celebration, setCelebration] = useState<CelebrationPayload | null>(null);
  const [pending, setPending] = useState<CelebrationPayload[]>([]);
  const [pendingTotals, setPendingTotals] = useState<{ correct: number; answered: number } | null>(
    null,
  );

  const current = items[index] ?? null;
  const mode = current ? itemMode(lesson.type, current) : "chord";

  useEffect(() => {
    setIndex(0);
    setCorrectCount(0);
    setAnswered(0);
    setStatus("idle");
    setMessage("");
    setDone(null);
    setError("");
    setPendingTotals(null);
  }, [lesson.id]);

  useEffect(() => {
    if (done || !lesson.content.passage_speak) return;
    feedback.speak(lesson.content.passage_speak);
  }, [lesson.id, lesson.content.passage_speak, done]);

  useEffect(() => {
    if (!current || done) return;
    const text = current.speak || current.label;
    feedback.speak(text);
  }, [current, done, index]);

  useEffect(() => {
    if (!current || done) return;
    return subscribeInput((action) => {
      if (action.type === "prev") {
        goBack();
        return;
      }
      if (action.type === "next") {
        if (canGoNext()) goNext();
        return;
      }
      if (mode !== "chord") return;
      if (action.type === "dotPress" && action.down) {
        feedback.dot(action.dot);
      }
      if (action.type === "brailleChord") {
        judgeChord(action.dots);
      }
      if (action.type === "repeat") {
        feedback.speak(current.speak || current.label);
      }
      if (action.type === "hint" && current.dots.length) {
        feedback.speak(`Dots ${current.dots.join(" ")}`);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, done, mode, index, correctCount, answered, status, pendingTotals, submitting]);

  function canGoNext() {
    return Boolean(
      pendingTotals || status === "correct" || (lesson.type === "review" && status === "wrong"),
    );
  }

  function goNext() {
    if (submitting || !canGoNext()) return;
    const totals = pendingTotals ?? { correct: correctCount, answered: answered };
    setPendingTotals(null);
    if (index + 1 >= items.length) {
      void finish(totals.correct, totals.answered);
      return;
    }
    setIndex((value) => value + 1);
    setStatus("idle");
    setMessage("");
  }

  function goBack() {
    if (index <= 0 || submitting) return;
    setPendingTotals(null);
    setIndex((value) => value - 1);
    setStatus("idle");
    setMessage("");
  }

  function markReadyToAdvance(nextCorrect: number, nextAnswered: number, label: string) {
    setCorrectCount(nextCorrect);
    setAnswered(nextAnswered);
    setStatus("correct");
    setMessage(label);
    setPendingTotals({ correct: nextCorrect, answered: nextAnswered });
  }

  function judgeChord(dots: number[]) {
    if (!current || status !== "idle") return;
    const ok = sameDots(dots, current.dots);
    const reviewMode = lesson.type === "review";
    if (ok) {
      markReadyToAdvance(correctCount + 1, answered + 1, "Correct");
      feedback.correct(current.label);
      return;
    }
    feedback.wrong("Try again");
    setStatus("wrong");
    setMessage(`Not yet. Expected dots ${current.dots.join("-") || "none"}.`);
    if (reviewMode) {
      const nextAnswered = answered + 1;
      setAnswered(nextAnswered);
      setPendingTotals({ correct: correctCount, answered: nextAnswered });
      setMessage(`Not yet. Expected dots ${current.dots.join("-") || "none"}. Continue when ready.`);
      return;
    }
    window.setTimeout(() => {
      setStatus("idle");
      setMessage("");
    }, 1200);
  }

  function judgeChoice(choice: string) {
    if (!current || status !== "idle") return;
    const ok = choice === (current.answer ?? current.label);
    const reviewMode = lesson.type === "review";
    if (ok) {
      markReadyToAdvance(correctCount + 1, answered + 1, "Correct");
      feedback.correct(choice);
      return;
    }
    feedback.wrong("Try again");
    setStatus("wrong");
    setMessage(`Not ${choice}. Try another.`);
    if (reviewMode) {
      const nextAnswered = answered + 1;
      setAnswered(nextAnswered);
      setPendingTotals({ correct: correctCount, answered: nextAnswered });
      setMessage(`Not ${choice}. Continue when ready.`);
      return;
    }
    window.setTimeout(() => {
      setStatus("idle");
      setMessage("");
    }, 1200);
  }

  async function finish(finalCorrect: number, finalAnswered: number) {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    const total = Math.max(1, finalAnswered || items.length);
    const score = Math.round((finalCorrect / total) * 100);
    try {
      const passScore = lesson.content.pass_score ?? 70;
      const result = await postLessonComplete<CompleteResult>(
        lesson.id,
        { score, correct: finalCorrect, total },
        {
          passed: score >= passScore,
          pass_score: passScore,
          score,
          correct: finalCorrect,
          total,
          status: score >= passScore ? "completed" : "in_progress",
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
          detail: `You earned ${result.xp_awarded} XP from this lesson.`,
        });
      }
      for (const badge of result.new_badges) {
        queue.push({ kind: "badge", title: badge.title, detail: badge.description });
      }
      if (queue.length) {
        setCelebration(queue[0] ?? null);
        setPending(queue.slice(1));
      } else if (result.passed) {
        feedback.correct("Lesson complete");
      } else {
        feedback.wrong("Keep practicing");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save progress.");
    } finally {
      setSubmitting(false);
    }
  }

  function dismissCelebration() {
    if (pending.length) {
      setCelebration(pending[0] ?? null);
      setPending(pending.slice(1));
      return;
    }
    setCelebration(null);
  }

  if (!items.length) {
    return (
      <div className="banner" role="status">
        <strong>This lesson has no items yet.</strong>
      </div>
    );
  }

  if (done) {
    return (
      <section className="lesson-result" aria-live="polite">
        <h2 className="page-title">{done.passed ? "Lesson passed" : "Not passed yet"}</h2>
        <p className="page-copy">
          <strong>
            Score {done.score}% ({done.correct}/{done.total})
          </strong>
          {done.passed ? ` · +${done.xp_awarded} XP` : ` · need ${done.pass_score}%`}
        </p>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="continue-list">
          {done.next_lesson_id ? (
            <Link className="primary-button link-button" to={`/app/braille/lessons/${done.next_lesson_id}`}>
              Next lesson
            </Link>
          ) : null}
          <Link className="secondary-button link-button" to="/app/braille">
            Back to Braille units
          </Link>
        </div>
        <CelebrationOverlay payload={celebration} onDismiss={dismissCelebration} />
      </section>
    );
  }

  return (
    <section className="lesson-player" aria-labelledby="lesson-item-title">
      <p className="meter">
        <strong>
          Item {index + 1} of {items.length}
        </strong>{" "}
        · correct {correctCount}
      </p>
      <h2 id="lesson-item-title" className="page-title">
        {current?.label}
      </h2>
      <p className="page-copy">
        <strong>{lesson.content.instruction}</strong>
      </p>
      {lesson.content.passage ? (
        <blockquote className="story-passage" cite="lesson">
          <strong>{lesson.content.passage}</strong>
        </blockquote>
      ) : null}
      {current?.note ? (
        <p className="meter">
          <strong>{current.note}</strong>
        </p>
      ) : null}

      {current && (current.show_cell || mode === "choice") ? (
        <BrailleCell dots={current.dots} showNumbers />
      ) : null}

      {mode === "chord" ? (
        <>
          <div className="tabs" role="tablist" aria-label="Touch braille mode">
            <button
              type="button"
              className="tab-button"
              role="tab"
              aria-selected={touchMode === "chord"}
              onClick={() => setTouchMode("chord")}
            >
              Multi-touch chord
            </button>
            <button
              type="button"
              className="tab-button"
              role="tab"
              aria-selected={touchMode === "single"}
              onClick={() => setTouchMode("single")}
            >
              One-finger mode
            </button>
          </div>
          <TouchBraillePad mode={touchMode} />
          <PerkinsKeyboard targetDots={current?.dots ?? []} interactive />
        </>
      ) : (
        <div className="choice-grid" role="group" aria-label="Answer choices">
          {(current?.choices ?? []).map((choice) => (
            <button
              key={choice}
              type="button"
              className="primary-button"
              disabled={status !== "idle"}
              onClick={() => judgeChoice(choice)}
            >
              {choice}
            </button>
          ))}
        </div>
      )}

      {status === "correct" ? (
        <p className="success-text" role="status">
          <strong>{message}</strong>
        </p>
      ) : null}
      {status === "wrong" ? (
        <p className="field-error" role="status">
          <strong>{message}</strong>
        </p>
      ) : null}

      <div className="lesson-item-nav" role="group" aria-label="Lesson item navigation">
        <button
          type="button"
          className="lesson-arrow-btn"
          onClick={goBack}
          disabled={index <= 0 || submitting}
          aria-label="Previous item"
        >
          <span aria-hidden="true">←</span>
          <span>Back</span>
        </button>
        <p className="lesson-item-nav-meter">
          <strong>
            {index + 1} / {items.length}
          </strong>
        </p>
        <button
          type="button"
          className="lesson-arrow-btn is-forward"
          onClick={goNext}
          disabled={submitting || !canGoNext()}
          aria-label={index + 1 >= items.length ? "Finish lesson" : "Next item"}
        >
          <span>{index + 1 >= items.length ? "Finish" : "Next"}</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
      <p className="meter lesson-nav-hint">
        <strong>Arrow keys</strong> also move Back / Next when an item is answered.
      </p>

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {submitting ? <p className="status">Saving progress…</p> : null}
    </section>
  );
}
