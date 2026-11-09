import { useState } from "react";
import { Link } from "react-router-dom";
import { BrailleMiniDemo } from "@/features/braille/BrailleMiniDemo";
import { CursiveMiniDemo } from "@/features/cursive/CursiveMiniDemo";
import { usePreferences } from "@/store/preferences";
import { TEXT_SCALE_OPTIONS, THEME_OPTIONS } from "@/theme/tokens";

type DemoTab = "braille" | "cursive";

export function LandingPage() {
  const [tab, setTab] = useState<DemoTab>("braille");
  const settings = usePreferences((s) => s.settings);
  const setSettings = usePreferences((s) => s.setSettings);
  const [soundOn, setSoundOn] = useState(true);

  return (
    <div className="landing-shell" aria-label="Dotline landing">
      <header className="landing-hero">
        <h1 className="brand landing-brand">Dotline</h1>
        <p className="status landing-pitch">Learn braille and cursive — made for low vision.</p>
        <div className="cta-row">
          <Link className="primary-button link-button" to="/signup">
            Sign up
          </Link>
          <Link className="secondary-button link-button" to="/login">
            Log in
          </Link>
        </div>
      </header>

      <section className="landing-controls" aria-label="Accessibility quick toggles">
        <label className="field-label" htmlFor="landing-theme">
          Theme
          <select
            id="landing-theme"
            className="field-select"
            value={settings.theme}
            onChange={(event) =>
              setSettings({ theme: event.target.value as typeof settings.theme })
            }
          >
            {THEME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label" htmlFor="landing-scale">
          Text size
          <select
            id="landing-scale"
            className="field-select"
            value={settings.text_scale}
            onChange={(event) => setSettings({ text_scale: Number(event.target.value) })}
          >
            {TEXT_SCALE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          <input
            type="checkbox"
            checked={soundOn}
            onChange={(event) => setSoundOn(event.target.checked)}
          />{" "}
          Sound {soundOn ? "on" : "off"}
        </label>
      </section>

      <section className="landing-demo" aria-label="Try it now">
        <div className="tabs" role="tablist" aria-label="Demo mode">
          <button
            type="button"
            role="tab"
            className="tab-button"
            aria-selected={tab === "braille"}
            onClick={() => setTab("braille")}
          >
            Braille demo
          </button>
          <button
            type="button"
            role="tab"
            className="tab-button"
            aria-selected={tab === "cursive"}
            onClick={() => setTab("cursive")}
          >
            Cursive demo
          </button>
        </div>
        <div className="landing-demo-panel">
          {tab === "braille" ? <BrailleMiniDemo /> : <CursiveMiniDemo />}
        </div>
      </section>
    </div>
  );
}
