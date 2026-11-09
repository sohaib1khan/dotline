import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CelebrationOverlay, type CelebrationPayload } from "@/components/CelebrationOverlay";
import { Field, FormStatus } from "@/components/AuthForm";
import { sampleGlyph, scoreAgainstGuide, type GlyphDef, type Point } from "@/features/cursive/geometry";
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

export function SignatureStudioPage() {
  const handedness = usePreferences((s) => s.settings.handedness);
  const [name, setName] = useState("");
  const [strokesLib, setStrokesLib] = useState<StrokesPayload | null>(null);
  const [letterIndex, setLetterIndex] = useState(0);
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
  const glyph = currentLetter && strokesLib ? strokesLib.letters[currentLetter] : null;

  useEffect(() => {
    void apiGet<StrokesPayload>("/api/cursive/strokes").then(setStrokesLib).catch(() => undefined);
    void apiGet<SavedSignature[]>("/api/cursive/signatures").then(setSaved).catch(() => undefined);
  }, []);

  function onLetterStroke(points: Point[]) {
    if (!glyph) return;
    const result = scoreAgainstGuide(points, sampleGlyph(glyph.strokes));
    setMessage(result.feedback);
    if (result.score >= 55) {
      feedback.correct(currentLetter ?? "Good");
      if (letterIndex + 1 >= letters.length) {
        setPhase("full");
        setMessage("Now write your full signature freely.");
        feedback.speak("Now write your full signature");
      } else {
        setLetterIndex((value) => value + 1);
      }
    } else {
      feedback.wrong(result.feedback);
    }
  }

  async function saveSignature() {
    setError("");
    try {
      const guide = letters
        .map((ch) => strokesLib?.letters[ch])
        .filter(Boolean)
        .flatMap((g) => sampleGlyph(g!.strokes));
      const scored = fullStroke.length
        ? scoreAgainstGuide(fullStroke, guide.length ? guide : fullStroke)
        : { score: 70, feedback: "Saved." };
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
        score: scored.score,
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

      {letters.length > 0 && phase === "letters" && glyph ? (
        <>
          <p className="meter">
            <strong>
              Letter {letterIndex + 1}/{letters.length}: {currentLetter}
            </strong>
          </p>
          <TraceScene3D
            strokes={glyph.strokes}
            mode="trace"
            mirror={handedness === "left"}
            watchKey={`${currentLetter}-${letterIndex}`}
            onStrokeEnd={onLetterStroke}
          />
        </>
      ) : null}

      {phase === "full" ? (
        <>
          <p className="page-copy">
            <strong>Write your full signature below, then save.</strong>
          </p>
          <TraceScene3D
            strokes={
              letters
                .map((ch) => strokesLib?.letters[ch]?.strokes[0])
                .filter(Boolean)
                .map((stroke) => stroke!) ?? []
            }
            mode="free"
            mirror={handedness === "left"}
            onStrokeEnd={(points) => setFullStroke(points)}
          />
          <button className="primary-button" type="button" onClick={() => void saveSignature()} disabled={!fullStroke.length}>
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
