import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { TouchBraillePad } from "@/components/TouchBraillePad";
import { CelebrationOverlay, type CelebrationPayload } from "@/components/CelebrationOverlay";
import { LETTER_DOTS, lettersForDifficulty, sameDots } from "@/features/braille/alphabet";
import { submitGameScore, type ScoreSubmitResult } from "@/features/games/submitScore";
import { feedback } from "@/feedback";
import { subscribeInput } from "@/input";

type Falling = { id: number; letter: string; y: number; x: number };

type Props = { difficulty: number; durationS: number; highScore: number };

export function DotDropGame({ difficulty, durationS, highScore }: Props) {
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(durationS);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [hits, setHits] = useState(0);
  const [falling, setFalling] = useState<Falling[]>([]);
  const [result, setResult] = useState<ScoreSubmitResult | null>(null);
  const [celebration, setCelebration] = useState<CelebrationPayload | null>(null);
  const [error, setError] = useState("");
  const idRef = useRef(1);
  const letters = lettersForDifficulty(difficulty);
  const speed = 0.35 + difficulty * 0.12;

  useEffect(() => {
    if (!running) return;
    const spawn = window.setInterval(() => {
      const letter = letters[Math.floor(Math.random() * letters.length)]!;
      setFalling((prev) => [
        ...prev,
        { id: idRef.current++, letter, y: 0, x: 10 + Math.random() * 70 },
      ]);
    }, Math.max(700, 1600 - difficulty * 180));
    const tick = window.setInterval(() => {
      setFalling((prev) => {
        const next: Falling[] = [];
        let missed = 0;
        for (const item of prev) {
          const y = item.y + speed * (2.2 + difficulty * 0.4);
          if (y >= 100) missed += 1;
          else next.push({ ...item, y });
        }
        if (missed) {
          setMisses((value) => value + missed);
          feedback.wrong("Missed");
        }
        return next;
      });
    }, 50);
    const clock = window.setInterval(() => {
      setSecondsLeft((value) => {
        if (value <= 1) {
          window.clearInterval(spawn);
          window.clearInterval(tick);
          window.clearInterval(clock);
          setRunning(false);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => {
      window.clearInterval(spawn);
      window.clearInterval(tick);
      window.clearInterval(clock);
    };
  }, [running, difficulty, letters, speed]);

  useEffect(() => {
    if (!running) return;
    return subscribeInput((action) => {
      if (action.type === "dotPress" && action.down) feedback.dot(action.dot);
      if (action.type !== "brailleChord") return;
      setFalling((prev) => {
        const target = prev[0];
        if (!target) return prev;
        const expected = LETTER_DOTS[target.letter] ?? [];
        if (sameDots(action.dots, expected)) {
          setScore((value) => value + 10 + difficulty * 2);
          setHits((value) => value + 1);
          feedback.correct(target.letter);
          return prev.slice(1);
        }
        feedback.wrong("Wrong chord");
        return prev;
      });
    });
  }, [running, difficulty]);

  useEffect(() => {
    if (running || secondsLeft > 0 || result) return;
    if (hits === 0 && misses === 0 && score === 0) return;
    const total = hits + misses;
    const accuracy = total ? Math.round((hits / total) * 100) : 0;
    void submitGameScore("dot_drop", { score, accuracy, duration_s: durationS })
      .then((data) => {
        setResult(data);
        if (data.new_badges[0]) {
          setCelebration({
            kind: "badge",
            title: data.new_badges[0].title,
            detail: data.new_badges[0].description,
          });
        } else if (data.leveled_up && data.level) {
          setCelebration({
            kind: "level_up",
            title: `Level ${data.level}`,
            detail: `+${data.xp_awarded} XP`,
          });
        } else {
          feedback.correct("Round complete");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Save failed"));
  }, [running, secondsLeft, hits, misses, score, durationS, result]);

  function start() {
    setRunning(true);
    setSecondsLeft(durationS);
    setScore(0);
    setHits(0);
    setMisses(0);
    setFalling([]);
    setResult(null);
    setError("");
  }

  return (
    <section className="game-panel" aria-labelledby="dot-drop-title">
      <h1 id="dot-drop-title" className="page-title">
        Dot Drop
      </h1>
      <p className="page-copy">
        <strong>Type the chord before letters land.</strong> Difficulty {difficulty}.
      </p>
      <p className="meter">
        Time {secondsLeft}s · Score {score} · Hits {hits} · Misses {misses} · Best {highScore}
      </p>
      {!running && !result ? (
        <button className="primary-button" type="button" onClick={start}>
          Start round
        </button>
      ) : null}
      <div className="dot-drop-stage" aria-live="polite">
        {falling.map((item) => (
          <div
            key={item.id}
            className="dot-drop-letter"
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
          >
            <strong>{item.letter}</strong>
          </div>
        ))}
      </div>
      {running ? <TouchBraillePad mode="chord" /> : null}
      {result ? (
        <div className="lesson-result">
          <p className="success-text" role="status">
            <strong>
              Score {result.score} · +{result.xp_awarded} XP · best {result.high_score}
            </strong>
          </p>
          <button className="primary-button" type="button" onClick={start}>
            Play again
          </button>
          <Link className="secondary-button link-button" to="/app/games">
            All games
          </Link>
        </div>
      ) : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <CelebrationOverlay payload={celebration} onDismiss={() => setCelebration(null)} />
    </section>
  );
}
