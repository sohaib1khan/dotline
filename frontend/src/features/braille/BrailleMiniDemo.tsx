import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PerkinsKeyboard } from "@/components/PerkinsKeyboard";
import { TouchBraillePad } from "@/components/TouchBraillePad";
import { feedback } from "@/feedback";
import { subscribeInput } from "@/input";

type Step = {
  letter: string;
  dots: number[];
  title: string;
  guide: string;
  wrong: string;
};

const STEPS: Step[] = [
  {
    letter: "a",
    dots: [1],
    title: "Braille: make the letter a",
    guide: "Dot 1 only. Press F, then release all keys — or tap the pad / keyboard keys below.",
    wrong: "Not yet — letter a is only dot 1 (F key).",
  },
  {
    letter: "b",
    dots: [1, 2],
    title: "Next: letter b",
    guide: "Dots 1 and 2. Hold F and D together, then release.",
    wrong: "Not yet — letter b is dots 1 and 2 (F and D together).",
  },
  {
    letter: "c",
    dots: [1, 4],
    title: "Last demo letter: c",
    guide: "Dots 1 and 4. Hold F and J together, then release.",
    wrong: "Not yet — letter c is dots 1 and 4 (F and J together).",
  },
];

function sameDots(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  const left = [...a].sort((x, y) => x - y);
  const right = [...b].sort((x, y) => x - y);
  return left.every((value, index) => value === right[index]);
}

type Props = {
  onTryCursive?: () => void;
};

export function BrailleMiniDemo({ onTryCursive }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [chord, setChord] = useState<number[]>([]);
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [mode, setMode] = useState<"chord" | "single">("chord");
  const [finished, setFinished] = useState(false);

  const step = STEPS[stepIndex]!;

  useEffect(() => {
    if (finished) return;
    feedback.speak(`${step.title}. ${step.guide}`);
  }, [step, finished]);

  useEffect(() => {
    if (finished) return;
    return subscribeInput((action) => {
      if (action.type === "dotPress" && action.down) {
        feedback.dot(action.dot);
        setResult("idle");
      }
      if (action.type !== "brailleChord") return;
      setChord(action.dots);
      const ok = sameDots(action.dots, step.dots);
      if (ok) {
        setResult("correct");
        feedback.correct(`Correct. That is braille ${step.letter}.`);
      } else {
        setResult("wrong");
        feedback.wrong(step.wrong);
      }
    });
  }, [step, finished]);

  function goNext() {
    if (stepIndex + 1 >= STEPS.length) {
      setFinished(true);
      feedback.speak("Nice work. Three letters done. Start learning, or try cursive next.");
      return;
    }
    setStepIndex((value) => value + 1);
    setChord([]);
    setResult("idle");
  }

  function restart() {
    setStepIndex(0);
    setChord([]);
    setResult("idle");
    setFinished(false);
  }

  if (finished) {
    return (
      <div className="demo-block" aria-labelledby="braille-demo-title">
        <h2 id="braille-demo-title" className="demo-title">
          You made a, b, and c
        </h2>
        <p className="page-copy">
          <strong>That is the start of braille.</strong> Sign up to keep going through full lessons,
          or try a cursive stroke next.
        </p>
        <div className="demo-actions">
          <Link className="primary-button link-button" to="/signup">
            Start learning
          </Link>
          {onTryCursive ? (
            <button className="secondary-button" type="button" onClick={onTryCursive}>
              Try cursive
            </button>
          ) : null}
          <button className="secondary-button" type="button" onClick={restart}>
            Practice a–c again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="demo-block" aria-labelledby="braille-demo-title">
      <p className="meter">
        <strong>
          Demo letter {stepIndex + 1} of {STEPS.length}
        </strong>
      </p>
      <h2 id="braille-demo-title" className="demo-title">
        {step.title}
      </h2>
      <p className="page-copy">
        <strong>{step.guide}</strong>
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
      <PerkinsKeyboard targetDots={step.dots} interactive />
      <p className="meter" aria-live="polite">
        Last chord: {chord.length ? chord.join("-") : "—"}
      </p>
      {result === "correct" ? (
        <>
          <p className="success-text" role="status">
            <strong>Correct — that is braille {step.letter}.</strong>
          </p>
          <div className="demo-actions">
            <button className="primary-button" type="button" onClick={goNext}>
              {stepIndex + 1 >= STEPS.length ? "Finish demo" : "Next letter"}
            </button>
          </div>
        </>
      ) : null}
      {result === "wrong" ? (
        <p className="field-error" role="status">
          <strong>{step.wrong}</strong> Try again.
        </p>
      ) : null}
    </div>
  );
}
