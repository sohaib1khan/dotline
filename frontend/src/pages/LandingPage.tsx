import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/BrandMark";
import { BrailleMiniDemo } from "@/features/braille/BrailleMiniDemo";
import { CursiveMiniDemo } from "@/features/cursive/CursiveMiniDemo";
import {
  canPromptInstall,
  isStandaloneDisplay,
  promptInstall,
  subscribeInstallAvailability,
} from "@/pwa/install";
import { usePreferences } from "@/store/preferences";
import { TEXT_SCALE_OPTIONS, THEME_OPTIONS } from "@/theme/tokens";

type MainTab = "braille" | "cursive" | "story";

export function LandingPage() {
  const [tab, setTab] = useState<MainTab>("braille");
  const settings = usePreferences((s) => s.settings);
  const setSettings = usePreferences((s) => s.setSettings);
  const [canInstall, setCanInstall] = useState(false);
  const [installBusy, setInstallBusy] = useState(false);
  const [installNote, setInstallNote] = useState("");

  useEffect(() => {
    const refresh = () => setCanInstall(canPromptInstall() && !isStandaloneDisplay());
    refresh();
    return subscribeInstallAvailability(refresh);
  }, []);

  async function onInstall() {
    setInstallBusy(true);
    setInstallNote("");
    try {
      const outcome = await promptInstall();
      if (outcome === "accepted") {
        setInstallNote("Dotline was installed on this device.");
        setCanInstall(false);
      } else if (outcome === "dismissed") {
        setInstallNote("Install dismissed — you can try again anytime.");
      } else {
        setInstallNote("Install is not available in this browser right now.");
      }
    } finally {
      setInstallBusy(false);
    }
  }

  const soundOn = settings.sfx_enabled && settings.speech_enabled;

  return (
    <div className="landing-shell" aria-label="Dotline landing">
      <div className="landing-atmosphere" aria-hidden="true" />

      <header className="landing-hero">
        <h1 className="brand landing-brand brand-with-mark">
          <BrandMark to="/" />
        </h1>
        <p className="landing-pitch">
          <strong>Braille and cursive for low vision — practice that feels calm and clear.</strong>
        </p>
        <div className="cta-row landing-cta">
          <Link className="primary-button link-button" to="/signup">
            Start learning
          </Link>
          <Link className="secondary-button link-button" to="/login">
            Log in
          </Link>
          {canInstall ? (
            <button
              type="button"
              className="secondary-button"
              disabled={installBusy}
              onClick={() => void onInstall()}
            >
              {installBusy ? "Installing…" : "Install app"}
            </button>
          ) : null}
        </div>
        {installNote ? (
          <p className="landing-install-note" role="status">
            <strong>{installNote}</strong>
          </p>
        ) : null}
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
        <label className="field-label landing-sound-toggle" htmlFor="landing-sound">
          <input
            id="landing-sound"
            type="checkbox"
            checked={soundOn}
            onChange={(event) => {
              const on = event.target.checked;
              setSettings({ sfx_enabled: on, speech_enabled: on });
            }}
          />
          Sound {soundOn ? "on" : "off"}
        </label>
      </section>

      <section className="landing-main" aria-label="Try Dotline">
        <div className="landing-try-header">
          <h2 className="landing-try-title">Try a minute of practice</h2>
          <p className="landing-try-copy">
            <strong>No account needed.</strong> Feel a braille chord or trace a letter — then sign up
            when you are ready.
          </p>
        </div>

        <div className="tabs landing-main-tabs" role="tablist" aria-label="Landing sections">
          <button
            type="button"
            role="tab"
            className="tab-button"
            aria-selected={tab === "braille"}
            id="tab-braille"
            aria-controls="landing-panel"
            onClick={() => setTab("braille")}
          >
            Braille
          </button>
          <button
            type="button"
            role="tab"
            className="tab-button"
            aria-selected={tab === "cursive"}
            id="tab-cursive"
            aria-controls="landing-panel"
            onClick={() => setTab("cursive")}
          >
            Cursive
          </button>
          <button
            type="button"
            role="tab"
            className="tab-button"
            aria-selected={tab === "story"}
            id="tab-story"
            aria-controls="landing-panel"
            onClick={() => setTab("story")}
          >
            Why Dotline
          </button>
        </div>

        <div
          className={`landing-panel landing-panel-${tab}`}
          id="landing-panel"
          role="tabpanel"
          aria-labelledby={
            tab === "braille" ? "tab-braille" : tab === "cursive" ? "tab-cursive" : "tab-story"
          }
        >
          {tab === "braille" ? <BrailleMiniDemo onTryCursive={() => setTab("cursive")} /> : null}
          {tab === "cursive" ? <CursiveMiniDemo /> : null}
          {tab === "story" ? <CreatorStory /> : null}
        </div>
      </section>
    </div>
  );
}

function CreatorStory() {
  return (
    <article className="landing-story" aria-labelledby="story-title">
      <h2 id="story-title" className="demo-title">
        Why I built Dotline
      </h2>
      <p className="landing-story-lead">
        <strong>My name is Sohaib Khan.</strong> I wanted to learn braille, and I also wanted to
        brush up on my cursive. They look like two separate skills — but for the brain, they are one
        shared experience of reading and writing again.
      </p>
      <p className="page-copy">
        I am a low-vision learner myself. That is why Dotline is designed low-vision first: big type,
        high contrast, keyboard and touch, sound with every visual cue, and layouts that still work
        when you zoom.
      </p>
      <ul className="landing-story-points">
        <li>
          <strong>Braille first</strong> — English UEB Grade 1 for beginners.
        </li>
        <li>
          <strong>Cursive next</strong> — tracing that rebuilds stroke memory.
        </li>
        <li>
          <strong>Your server, your data</strong> — installable PWA you can host yourself.
        </li>
      </ul>
      <p className="landing-story-link-row">
        <a
          className="primary-button link-button"
          href="https://sohaib0khan.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Visit sohaib0khan.com
        </a>
        <Link className="secondary-button link-button" to="/signup">
          Create an account
        </Link>
      </p>
    </article>
  );
}
