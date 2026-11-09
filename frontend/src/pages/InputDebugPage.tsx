import { useEffect, useState } from "react";
import { TouchBraillePad } from "@/components/TouchBraillePad";
import { feedback, getConnectedGamepads } from "@/feedback";
import { clearRecentInputActions, getRecentInputActions, subscribeInput } from "@/input";
import type { InputAction } from "@/input/types";

export function InputDebugPage() {
  const [events, setEvents] = useState<InputAction[]>([]);
  const [pads, setPads] = useState<string[]>([]);

  useEffect(() => {
    setEvents(getRecentInputActions());
    const unsub = subscribeInput(() => setEvents(getRecentInputActions()));
    const id = window.setInterval(() => {
      setPads(getConnectedGamepads().map((pad) => pad.id));
    }, 1000);
    return () => {
      unsub();
      window.clearInterval(id);
    };
  }, []);

  return (
    <section aria-labelledby="input-debug-title">
      <h1 id="input-debug-title" className="page-title">
        Input debug
      </h1>
      <p className="page-copy">Live abstract actions from keyboard, touch, pointer, and gamepad.</p>

      <div className="stub-grid">
        <article className="stub-card">
          <h2>Controllers</h2>
          <p>{pads.length ? pads.join(" · ") : "None connected"}</p>
        </article>
        <article className="stub-card">
          <h2>Quick tests</h2>
          <p>
            <button className="secondary-button" type="button" onClick={() => feedback.correct()}>
              Correct
            </button>{" "}
            <button className="secondary-button" type="button" onClick={() => feedback.wrong()}>
              Wrong
            </button>
          </p>
        </article>
      </div>

      <div className="banner" style={{ marginTop: "1rem" }}>
        <strong>Touch braille pad</strong>
        <TouchBraillePad />
      </div>

      <div className="cta-row" style={{ justifyContent: "flex-start", marginTop: "1rem" }}>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            clearRecentInputActions();
            setEvents([]);
          }}
        >
          Clear log
        </button>
      </div>

      <ol className="input-log" aria-live="polite">
        {[...events].reverse().map((event, index) => (
          <li key={`${event.type}-${index}`}>
            <code>{JSON.stringify(event)}</code>
          </li>
        ))}
      </ol>
    </section>
  );
}
