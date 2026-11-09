import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CelebrationOverlay, type CelebrationPayload } from "@/components/CelebrationOverlay";
import { Field, FormStatus } from "@/components/AuthForm";
import { scoreAgainstStroke, type GlyphDef, type Point } from "@/features/cursive/geometry";
import { TraceScene3D } from "@/features/cursive/TraceScene3D";
import { feedback } from "@/feedback";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { usePreferences } from "@/store/preferences";

type StrokesPayload = {
  letters: Record<string, GlyphDef>;
};

type SavedSignature = {
  id: string;
  name_text: string;
  score: number | null;
  created_at: string;
};

function resolveGlyph(lib: StrokesPayload | null, ch: string): GlyphDef | null {
  if (!lib) return null;
  return lib.letters[ch] ?? lib.letters[ch.toLowerCase()] ?? lib.letters[ch.toUpperCase()] ?? null;
}

function strokeHint(letter: string, strokeIndex: number, total: number): string {
  if (total <= 1) return `Trace ${letter}.`;
  if (strokeIndex === 0) {
    return `Stroke 1 of ${total} for “${letter}” — draw the main stem. Then lift your pen.`;
  }
  if (letter.toLowerCase() === "i" || letter.toLowerCase() === "j") {
    return `Stroke ${strokeIndex + 1} of ${total} — lift and add the dot.`;
  }
  if (letter.toLowerCase() === "t" || letter.toLowerCase() === "f") {
    return `Stroke ${strokeIndex + 1} of ${total} — lift and add the crossbar.`;
  }
  return `Stroke ${strokeIndex + 1} of ${total} — lift and continue the next part.`;
}

export function SignatureStudioPage() {
  const handedness = usePreferences((s) => s.settings.handedness);
  const [name, setName] = useState("");
  const [strokesLib, setStrokesLib] = useState<StrokesPayload | null>(null);
  const [letterIndex, setLetterIndex] = useState(0);
  const [strokeIndex, setStrokeIndex] = useState(0);
  const [phase, setPhase] = useState<"letters" | "full" | "done">("letters");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedSignature[]>([]);
  const [celebration, setCelebration] = useState<CelebrationPayload | null>(null);
  const [fullStroke, setFullStroke] = useState<Point[]>([]);

  const letters = useMemo(
    () =>
      name
        .split("")
        .filter((ch) => /[a-zA-Z]/.test(ch))
        .map((ch) => ch),
    [name],
  );

  const currentLetter = letters[letterIndex] ?? null;
  const glyph = currentLetter ? resolveGlyph(strokesLib, currentLetter) : null;
  const strokeCount = glyph?.strokes.length ?? 0;
  const activeStroke = glyph?.strokes[strokeIndex] ?? null;

  useEffect(() => {
    void apiGet<StrokesPayload>("/api/cursive/strokes").then(setStrokesLib).catch(() => undefined);
    void apiGet<SavedSignature[]>("/api/cursive/signatures").then(setSaved).catch(() => undefined);
  }, []);

  useEffect(() => {
    setStrokeIndex(0);
  }, [letterIndex, currentLetter]);

  function advanceAfterLetter() {
    if (letterIndex + 1 >= letters.length) {
      setPhase("full");
      setMessage("Now write your full signature freely.");
      feedback.speak("Now write your full signature");
      return;
    }
    setLetterIndex((value) => value + 1);
    setStrokeIndex(0);
  }

  function onLetterStroke(points: Point[]) {
    if (!glyph || !activeStroke || !currentLetter) return;
    const result = scoreAgainstStroke(points, activeStroke, {
      startTolerance: 32,
      shapeTolerance: 24,
      minPoints: activeStroke.path.length < 28 ? 3 : 5,
    });
    setMessage(result.feedback);
    if (result.score >= 50) {
      if (strokeIndex + 1 < strokeCount) {
        const next = strokeIndex + 1;
        setStrokeIndex(next);
        const hint = strokeHint(currentLetter, next, strokeCount);
        setMessage(`Nice. ${hint}`);
        feedback.correct("Good stroke");
        feedback.speak(hint);
        return;
      }
      feedback.correct(currentLetter);
      setMessage(`“${currentLetter}” complete.`);
      advanceAfterLetter();
      return;
    }
    feedback.wrong(result.feedback);
  }

  async function saveSignature() {
    setError("");
    try {
      const result = await apiPost<{
        id: string;
        name_text: string;
        score: number | null;
        created_at: string;
        completion: {
          leveled_up?: boolean;
          level?: number;
          new_badges?: { title: string; description: string }[];
          xp_awarded?: number;
        } | null;
      }>("/api/cursive/signatures", {
        name_text: name.trim(),
        strokes: fullStroke,
        score: 70,
      });
      setSaved((prev) => [
        {
          id: result.id,
          name_text: result.name_text,
          score: result.score,
          created_at: result.created_at,
        },
        ...prev,
      ]);
      setPhase("done");
      feedback.correct("Signature saved");
      const completion = result.completion;
      if (completion?.new_badges?.length) {
        const badge = completion.new_badges[0]!;
        setCelebration({ kind: "badge", title: badge.title, detail: badge.description });
      } else if (completion?.leveled_up && completion.level) {
        setCelebration({
          kind: "level_up",
          title: `Level ${completion.level}`,
          detail: `+${completion.xp_awarded ?? 0} XP`,
        });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save signature.");
    }
  }

  return (
    <section className="braille-lesson" aria-labelledby="signature-title">
      <p className="meter">
        <Link to="/app/cursive">← Cursive units</Link>
      </p>
      <h1 id="signature-title" className="page-title">
        Signature Studio
      </h1>
      <p className="page-copy">
        <strong>Type your name, practice each letter, then write the full signature.</strong>
      </p>

      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          setLetterIndex(0);
          setStrokeIndex(0);
          setPhase("letters");
          setFullStroke([]);
          setMessage("");
        }}
      >
        <Field id="sig-name" label="Your name" value={name} onChange={setName} autoComplete="name" />
        <button className="primary-button" type="submit" disabled={!name.trim()}>
          Start practice
        </button>
      </form>

      {letters.length > 0 && phase === "letters" && glyph && activeStroke ? (
        <>
          <p className="meter">
            <strong>
              Letter {letterIndex + 1}/{letters.length}: {currentLetter}
            </strong>
            {strokeCount > 1 ? ` · stroke ${strokeIndex + 1}/${strokeCount}` : ""}
          </p>
          <p className="page-copy">
            <strong>{strokeHint(currentLetter ?? "", strokeIndex, strokeCount)}</strong>
          </p>
          <TraceScene3D
            strokes={[activeStroke]}
            mode="trace"
            mirror={handedness === "left"}
            watchKey={`${currentLetter}-${letterIndex}-${strokeIndex}`}
            onStrokeEnd={onLetterStroke}
          />
          <div className="demo-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={letterIndex <= 0 && strokeIndex <= 0}
              onClick={() => {
                if (strokeIndex > 0) {
                  setStrokeIndex((value) => value - 1);
                  setMessage("");
                  return;
                }
                if (letterIndex > 0) {
                  setLetterIndex((value) => value - 1);
                  setStrokeIndex(0);
                  setMessage("");
                }
              }}
            >
              Back
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                if (strokeIndex + 1 < strokeCount) {
                  setStrokeIndex((value) => value + 1);
                  setMessage("Skipped ahead — you can still practice this stroke.");
                  return;
                }
                advanceAfterLetter();
              }}
            >
              Skip stroke
            </button>
          </div>
        </>
      ) : null}

      {letters.length > 0 && phase === "letters" && !glyph && currentLetter ? (
        <p className="field-error" role="alert">
          <strong>No stroke guide for “{currentLetter}”.</strong> Try another letter.
        </p>
      ) : null}

      {phase === "full" ? (
        <>
          <p className="page-copy">
            <strong>Write your full signature below, then save.</strong>
          </p>
          <TraceScene3D
            strokes={
              letters
                .map((ch) => resolveGlyph(strokesLib, ch)?.strokes[0])
                .filter(Boolean)
                .map((stroke) => stroke!) ?? []
            }
            mode="free"
            mirror={handedness === "left"}
            onStrokeEnd={(points) => setFullStroke(points)}
          />
          <button
            className="primary-button"
            type="button"
            onClick={() => void saveSignature()}
            disabled={!fullStroke.length}
          >
            Save signature
          </button>
        </>
      ) : null}

      {phase === "done" ? (
        <p className="success-text" role="status">
          <strong>Signature saved.</strong> You can practice again anytime.
        </p>
      ) : null}

      {message ? (
        <p className="meter" role="status">
          <strong>{message}</strong>
        </p>
      ) : null}
      <FormStatus message={error} />

      {saved.length ? (
        <div className="unit-card">
          <h2>Recent signatures</h2>
          <ul className="lesson-list">
            {saved.map((item) => (
              <li key={item.id}>
                <strong>{item.name_text}</strong>
                {item.score != null ? ` · ${Math.round(item.score)}%` : ""} ·{" "}
                {new Date(item.created_at).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <CelebrationOverlay payload={celebration} onDismiss={() => setCelebration(null)} />
    </section>
  );
}
