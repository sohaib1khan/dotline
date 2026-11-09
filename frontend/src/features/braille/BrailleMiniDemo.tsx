import { useEffect, useState } from "react";
import { TouchBraillePad } from "@/components/TouchBraillePad";
import { feedback } from "@/feedback";
import { subscribeInput } from "@/input";

export function BrailleMiniDemo() {
  const [chord, setChord] = useState<number[]>([]);
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [mode, setMode] = useState<"chord" | "single">("chord");

  useEffect(() => {
    return subscribeInput((action) => {
      if (action.type === "dotPress" && action.down) {
        feedback.dot(action.dot);
      }
      if (action.type === "brailleChord") {
        setChord(action.dots);
        const ok = action.dots.length === 1 && action.dots[0] === 1;
        setResult(ok ? "correct" : "wrong");
        if (ok) feedback.correct("Correct. That is braille a.");
        else feedback.wrong("Not yet. Letter a is only dot 1.");
      }
    });
  }, []);

  return (
    <div className="demo-block" aria-labelledby="braille-demo-title">
      <h2 id="braille-demo-title" className="demo-title">
        Braille: make the letter a
      </h2>
      <p className="page-copy">
        Dot 1 only. Press <kbd>F</kbd> then release all keys, use a controller, or tap the pad.
      </p>
      <div className="tabs" role="tablist" aria-label="Touch braille mode">
        <button
          type="button"
          className="tab-button"
          role="tab"
          aria-selected={mode === "chord"}
          onClick={() => setMode("chord")}
        >
          Multi-touch chord
        </button>
        <button
          type="button"
          className="tab-button"
          role="tab"
          aria-selected={mode === "single"}
          onClick={() => setMode("single")}
        >
          One-finger mode
        </button>
      </div>
      <TouchBraillePad mode={mode} />
      <p className="meter" aria-live="polite">
        Last chord: {chord.length ? chord.join("-") : "—"}
      </p>
      {result === "correct" ? (
        <p className="success-text" role="status">
          Correct — that is braille a.
        </p>
      ) : null}
      {result === "wrong" ? (
        <p className="field-error" role="status">
          Not yet — letter a is only dot 1 (F key).
        </p>
      ) : null}
    </div>
  );
}
