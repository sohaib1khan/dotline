import { useState } from "react";
import { emitInput } from "@/input/bus";

const LAYOUT = [1, 4, 2, 5, 3, 6];

type Mode = "chord" | "single";

export function TouchBraillePad({
  mode = "chord",
  onChord,
}: {
  mode?: Mode;
  onChord?: (dots: number[]) => void;
}) {
  const [held, setHeld] = useState<Set<number>>(new Set());
  const [staged, setStaged] = useState<Set<number>>(new Set());

  function press(dot: number, down: boolean) {
    emitInput({ type: "dotPress", dot, down, source: "touch" });
    if (mode === "single") {
      setStaged((prev) => {
        const next = new Set(prev);
        if (down) {
          if (next.has(dot)) next.delete(dot);
          else next.add(dot);
        }
        return next;
      });
      return;
    }
    setHeld((prev) => {
      const next = new Set(prev);
      if (down) next.add(dot);
      else next.delete(dot);
      if (!down && next.size === 0 && prev.size > 0) {
        const dots = Array.from(prev).sort((a, b) => a - b);
        emitInput({ type: "brailleChord", dots, source: "touch" });
        onChord?.(dots);
      }
      return next;
    });
  }

  function submitSingle() {
    const dots = Array.from(staged).sort((a, b) => a - b);
    emitInput({ type: "brailleChord", dots, source: "touch" });
    onChord?.(dots);
    setStaged(new Set());
  }

  const active = mode === "single" ? staged : held;

  return (
    <div className="touch-braille">
      <div className="braille-cell" role="group" aria-label="Touch braille cell">
        {LAYOUT.map((dot) => (
          <button
            key={dot}
            type="button"
            className={`braille-dot${active.has(dot) ? " is-on" : ""}`}
            aria-pressed={active.has(dot)}
            aria-label={`Dot ${dot}`}
            onPointerDown={(event) => {
              event.preventDefault();
              press(dot, true);
            }}
            onPointerUp={(event) => {
              event.preventDefault();
              if (mode === "chord") press(dot, false);
            }}
            onPointerLeave={() => {
              if (mode === "chord" && held.has(dot)) press(dot, false);
            }}
            onClick={() => {
              if (mode === "single") press(dot, true);
            }}
          >
            <span aria-hidden="true">{dot}</span>
          </button>
        ))}
      </div>
      {mode === "single" ? (
        <button className="secondary-button" type="button" onClick={submitSingle}>
          Enter chord
        </button>
      ) : null}
    </div>
  );
}
