import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CelebrationOverlay, type CelebrationPayload } from "@/components/CelebrationOverlay";
import { sampleGlyph, scoreAgainstGuide, type GlyphDef, type Point } from "@/features/cursive/geometry";
import { TraceScene3D } from "@/features/cursive/TraceScene3D";
import { submitGameScore, type ScoreSubmitResult } from "@/features/games/submitScore";
import { feedback } from "@/feedback";
import { apiGet } from "@/lib/api";
import { usePreferences } from "@/store/preferences";

const WORDS = ["cat", "me", "hi", "on", "at", "go", "we", "to", "be", "up", "sun", "pen"];

type Props = { difficulty: number; durationS: number; highScore: number };

export function WordWeaverGame({ difficulty, durationS, highScore }: Props) {
  const handedness = usePreferences((s) => s.settings.handedness);
  const [lib, setLib] = useState<Record<string, GlyphDef> | null>(null);
  const [word, setWord] = useState("cat");
  const [letterIndex, setLetterIndex] = useState(0);
  const [thread, setThread] = useState<Point[]>([]);
  const [score, setScore] = useState(0);
  const [wordsDone, setWordsDone] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(durationS);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ScoreSubmitResult | null>(null);
  const [celebration, setCelebration] = useState<CelebrationPayload | null>(null);
  const [message, setMessage] = useState("");

  const letters = useMemo(() => word.split(""), [word]);
  const current = letters[letterIndex] ?? null;
  const glyph = current && lib ? lib[current] : null;

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
    if (wordsDone === 0 && score === 0) return;
    const accuracy = Math.min(100, Math.round((score / Math.max(1, wordsDone * 100)) * 100));
    void submitGameScore("word_weaver", { score, accuracy, duration_s: durationS }).then((data) => {
      setResult(data);
      if (data.new_badges[0]) {
        setCelebration({
          kind: "badge",
          title: data.new_badges[0].title,
          detail: data.new_badges[0].description,
        });
      } else feedback.correct("Word woven");
    });
  }, [running, secondsLeft, result, wordsDone, score, durationS]);

  function pickWord() {
    const pool = WORDS.filter((item) => item.length <= (difficulty >= 3 ? 3 : 2) + 1);
    return pool[Math.floor(Math.random() * pool.length)] ?? "cat";
  }

  function start() {
    setWord(pickWord());
    setLetterIndex(0);
    setThread([]);
    setScore(0);
    setWordsDone(0);
    setSecondsLeft(durationS);
    setRunning(true);
    setResult(null);
    setMessage("");
  }

  function onStrokeEnd(points: Point[]) {
    if (!glyph || !current || !running) return;
    const scored = scoreAgainstGuide(points, sampleGlyph(glyph.strokes));
    setMessage(scored.feedback);
    if (scored.score < 55) {
      feedback.wrong(scored.feedback);
      return;
    }
    feedback.correct(current);
    setThread((prev) => [...prev, ...points]);
    setScore((value) => value + scored.score);
    if (letterIndex + 1 >= letters.length) {
      setWordsDone((value) => value + 1);
      setWord(pickWord());
      setLetterIndex(0);
      setMessage("Word complete — next word!");
    } else {
      setLetterIndex((value) => value + 1);
    }
  }

  return (
    <section className="game-panel" aria-labelledby="weaver-title">
      <h1 id="weaver-title" className="page-title">
        Word Weaver
      </h1>
      <p className="page-copy">
        <strong>Write each letter of the word before time runs out.</strong>
      </p>
      <p className="meter">
        Time {secondsLeft}s · Score {score} · Words {wordsDone} · Best {highScore}
      </p>
      {!running && !result ? (
        <button className="primary-button" type="button" onClick={start}>
          Start round
        </button>
      ) : null}
      {running ? (
        <>
          <p className="meter">
            <strong>
              Word: {word} · letter {current?.toUpperCase()} ({letterIndex + 1}/{letters.length})
            </strong>
          </p>
          <div className="thread-preview" aria-label="Glowing thread progress">
            <span style={{ width: `${Math.min(100, (thread.length / 40) * 10)}%` }} />
          </div>
          {glyph ? (
            <TraceScene3D
              strokes={glyph.strokes}
              mode="trace"
              mirror={handedness === "left"}
              watchKey={`${word}-${letterIndex}`}
              onStrokeEnd={onStrokeEnd}
            />
          ) : null}
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
