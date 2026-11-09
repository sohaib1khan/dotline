import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CelebrationOverlay, type CelebrationPayload } from "@/components/CelebrationOverlay";
import { sampleGlyph, scoreAgainstGuide, type GlyphDef, type Point } from "@/features/cursive/geometry";
import { TraceScene3D } from "@/features/cursive/TraceScene3D";
import { submitGameScore, type ScoreSubmitResult } from "@/features/games/submitScore";
import { feedback } from "@/feedback";
import { apiGet } from "@/lib/api";
import { usePreferences } from "@/store/preferences";

const POOL = ["a", "c", "e", "l", "n", "o", "u", "v", "m", "t"];

type Props = { difficulty: number; durationS: number; highScore: number };

export function LanternPathGame({ difficulty, durationS, highScore }: Props) {
  const handedness = usePreferences((s) => s.settings.handedness);
  const [lib, setLib] = useState<Record<string, GlyphDef> | null>(null);
  const [letter, setLetter] = useState("a");
  const [brightness, setBrightness] = useState(0);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(durationS);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ScoreSubmitResult | null>(null);
  const [celebration, setCelebration] = useState<CelebrationPayload | null>(null);
  const [message, setMessage] = useState("");

  const glyph = lib?.[letter] ?? null;
  const lanterns = useMemo(() => Array.from({ length: 5 }, (_, i) => i), []);

  useEffect(() => {
    void apiGet<{ letters: Record<string, GlyphDef> }>("/api/cursive/strokes").then((data) =>
      setLib(data.letters),
    );
  }, []);

  useEffect(() => {
    if (!running) return;
    const clock = window.setInterval(() => {
      setSecondsLeft((value) => {
        if (value <= 1) {
          setRunning(false);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(clock);
  }, [running]);

  useEffect(() => {
    if (running || secondsLeft > 0 || result) return;
    if (round === 0 && score === 0) return;
    const accuracy = Math.min(100, brightness);
    void submitGameScore("lantern_path", { score, accuracy, duration_s: durationS }).then((data) => {
      setResult(data);
      if (data.new_badges[0]) {
        setCelebration({
          kind: "badge",
          title: data.new_badges[0].title,
          detail: data.new_badges[0].description,
        });
      } else feedback.correct("Lanterns lit");
    });
  }, [running, secondsLeft, result, round, score, brightness, durationS]);

  function start() {
    const pool = POOL.slice(0, 4 + difficulty);
    setLetter(pool[Math.floor(Math.random() * pool.length)]!);
    setBrightness(0);
    setRound(0);
    setScore(0);
    setSecondsLeft(durationS);
    setRunning(true);
    setResult(null);
    setMessage("");
  }

  function onStrokeEnd(points: Point[]) {
    if (!glyph || !running) return;
    const scored = scoreAgainstGuide(points, sampleGlyph(glyph.strokes));
    setMessage(scored.feedback);
    setBrightness(scored.score);
    if (scored.score >= 55) {
      feedback.correct(letter);
      setScore((value) => value + scored.score);
      setRound((value) => value + 1);
      const pool = POOL.slice(0, 4 + difficulty);
      setLetter(pool[Math.floor(Math.random() * pool.length)]!);
    } else {
      feedback.wrong(scored.feedback);
    }
  }

  return (
    <section className="game-panel lantern-game" aria-labelledby="lantern-title">
      <h1 id="lantern-title" className="page-title">
        Lantern Path
      </h1>
      <p className="page-copy">
        <strong>Trace the letter to light lanterns.</strong> Accuracy = brightness.
      </p>
      <p className="meter">
        Time {secondsLeft}s · Score {score} · Round {round} · Best {highScore}
      </p>
      <div className="lantern-row" aria-label="Lantern brightness">
        {lanterns.map((index) => (
          <span
            key={index}
            className={`lantern${brightness >= (index + 1) * 20 ? " is-lit" : ""}`}
            aria-hidden="true"
          />
        ))}
      </div>
      {!running && !result ? (
        <button className="primary-button" type="button" onClick={start}>
          Start round
        </button>
      ) : null}
      {running && glyph ? (
        <>
          <p className="meter">
            <strong>Trace: {letter}</strong>
          </p>
          <TraceScene3D
            strokes={glyph.strokes}
            mode="trace"
            mirror={handedness === "left"}
            watchKey={`${letter}-${round}`}
            onStrokeEnd={onStrokeEnd}
          />
        </>
      ) : null}
      {message ? (
        <p className="meter" role="status">
          <strong>{message}</strong>
        </p>
      ) : null}
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
      <CelebrationOverlay payload={celebration} onDismiss={() => setCelebration(null)} />
    </section>
  );
}
