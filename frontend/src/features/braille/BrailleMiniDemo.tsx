import { useEffect, useState } from "react";

const KEY_TO_DOT: Record<string, number> = {
  f: 1,
  d: 2,
  s: 3,
  j: 4,
  k: 5,
  l: 6,
};

export function BrailleMiniDemo() {
  const [held, setHeld] = useState<Set<number>>(new Set());
  const [chord, setChord] = useState<number[]>([]);
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const dot = KEY_TO_DOT[key];
      if (!dot) return;
      event.preventDefault();
      setPressedKeys((prev) => new Set(prev).add(key));
      setHeld((prev) => new Set(prev).add(dot));
    }

    function onKeyUp(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const dot = KEY_TO_DOT[key];
      if (!dot) return;
      event.preventDefault();
      setPressedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        if (next.size === 0) {
          setHeld((current) => {
            const dots = Array.from(current).sort((a, b) => a - b);
            setChord(dots);
            const ok = dots.length === 1 && dots[0] === 1;
            setResult(ok ? "correct" : "wrong");
            return new Set();
          });
        }
        return next;
      });
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  function toggleDot(dot: number) {
    setHeld((prev) => {
      const next = new Set(prev);
      if (next.has(dot)) next.delete(dot);
      else next.add(dot);
      return next;
    });
  }

  function submitTouchChord() {
    const dots = Array.from(held).sort((a, b) => a - b);
    setChord(dots);
    const ok = dots.length === 1 && dots[0] === 1;
    setResult(ok ? "correct" : "wrong");
    setHeld(new Set());
  }

  return (
    <div className="demo-block" aria-labelledby="braille-demo-title">
      <h2 id="braille-demo-title" className="demo-title">
        Braille: make the letter a
      </h2>
      <p className="page-copy">
        Dot 1 only. Press <kbd>F</kbd> then release, or tap dot 1 and submit.
      </p>
      <div className="braille-cell" role="group" aria-label="Braille cell dots 1 to 6">
        {[1, 4, 2, 5, 3, 6].map((dot) => (
          <button
            key={dot}
            type="button"
            className={`braille-dot${held.has(dot) ? " is-on" : ""}`}
            aria-pressed={held.has(dot)}
            aria-label={`Dot ${dot}`}
            onClick={() => toggleDot(dot)}
          >
            <span aria-hidden="true">{dot}</span>
          </button>
        ))}
      </div>
      <button className="secondary-button" type="button" onClick={submitTouchChord}>
        Submit chord
      </button>
      <p className="meter" aria-live="polite">
        Keys held: {pressedKeys.size ? Array.from(pressedKeys).join(", ").toUpperCase() : "none"}
      </p>
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
