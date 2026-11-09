import { useEffect, useRef, useState } from "react";
import { emitInput, subscribeInput } from "@/input";
import { KEYBOARD_DOTS } from "@/input/mapping";

const LEFT: { key: string; dot: number }[] = [
  { key: "F", dot: 1 },
  { key: "D", dot: 2 },
  { key: "S", dot: 3 },
];
const RIGHT: { key: string; dot: number }[] = [
  { key: "J", dot: 4 },
  { key: "K", dot: 5 },
  { key: "L", dot: 6 },
];

type Props = {
  /** Dots the learner should press for the current item. */
  targetDots?: number[];
  /** When true, keys can be held with pointer/touch like a real keyboard. */
  interactive?: boolean;
  className?: string;
};

export function PerkinsKeyboard({
  targetDots = [],
  interactive = false,
  className = "",
}: Props) {
  const [pressed, setPressed] = useState<Set<number>>(new Set());
  const heldRef = useRef<Set<number>>(new Set());
  const targets = new Set(targetDots);

  useEffect(() => {
    return subscribeInput((action) => {
      if (action.type !== "dotPress") return;
      setPressed((prev) => {
        const next = new Set(prev);
        if (action.down) next.add(action.dot);
        else next.delete(action.dot);
        return next;
      });
    });
  }, []);

  function pressDot(dot: number, down: boolean) {
    if (!interactive) return;
    const held = heldRef.current;
    if (down) {
      if (held.has(dot)) return;
      held.add(dot);
      emitInput({ type: "dotPress", dot, down: true, source: "touch" });
      return;
    }
    if (!held.has(dot)) return;
    const snapshot = Array.from(held).sort((a, b) => a - b);
    held.delete(dot);
    emitInput({ type: "dotPress", dot, down: false, source: "touch" });
    if (held.size === 0 && snapshot.length > 0) {
      emitInput({ type: "brailleChord", dots: snapshot, source: "touch" });
    }
  }

  return (
    <div
      className={`perkins-keyboard ${className}`.trim()}
      role="group"
      aria-label="Perkins keyboard map. F D S are dots 1 2 3. J K L are dots 4 5 6."
    >
      <p className="perkins-keyboard-title">
        <strong>Keyboard</strong> —{" "}
        {interactive
          ? "tap or hold the lit keys (letter = braille dot)"
          : "press the lit keys on your keyboard (letter = braille dot)"}
      </p>
      <div className="perkins-keyboard-rows">
        <div className="perkins-hand" aria-label="Left hand dots 1 2 3">
          {LEFT.map((item) => (
            <KeyCap
              key={item.key}
              letter={item.key}
              dot={item.dot}
              pressed={pressed.has(item.dot)}
              target={targets.has(item.dot)}
              interactive={interactive}
              onPress={pressDot}
            />
          ))}
        </div>
        <div className="perkins-gap" aria-hidden="true" />
        <div className="perkins-hand" aria-label="Right hand dots 4 5 6">
          {RIGHT.map((item) => (
            <KeyCap
              key={item.key}
              letter={item.key}
              dot={item.dot}
              pressed={pressed.has(item.dot)}
              target={targets.has(item.dot)}
              interactive={interactive}
              onPress={pressDot}
            />
          ))}
        </div>
      </div>
      <p className="meter perkins-keyboard-hint">
        <strong>Hold the chord, then release all keys to submit.</strong> Space is ignored while
        dots are held.
      </p>
      <span className="sr-only">
        Mapping:{" "}
        {Object.entries(KEYBOARD_DOTS)
          .map(([letter, dot]) => `${letter.toUpperCase()} is dot ${dot}`)
          .join(". ")}
        .
      </span>
    </div>
  );
}

function KeyCap({
  letter,
  dot,
  pressed,
  target,
  interactive,
  onPress,
}: {
  letter: string;
  dot: number;
  pressed: boolean;
  target: boolean;
  interactive: boolean;
  onPress: (dot: number, down: boolean) => void;
}) {
  const className = `perkins-key${pressed ? " is-pressed" : ""}${target ? " is-target" : ""}`;
  const label = `Key ${letter}, braille dot ${dot}${target ? ", needed now" : ""}${pressed ? ", pressed" : ""}`;

  if (!interactive) {
    return (
      <div className={className} aria-label={label}>
        <span className="perkins-key-letter" aria-hidden="true">
          {letter}
        </span>
        <span className="perkins-key-dot" aria-hidden="true">
          Dot {dot}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-pressed={pressed}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onPress(dot, true);
      }}
      onPointerUp={(event) => {
        event.preventDefault();
        onPress(dot, false);
      }}
      onPointerCancel={() => onPress(dot, false)}
    >
      <span className="perkins-key-letter" aria-hidden="true">
        {letter}
      </span>
      <span className="perkins-key-dot" aria-hidden="true">
        Dot {dot}
      </span>
    </button>
  );
}
