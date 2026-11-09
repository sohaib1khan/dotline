import { useEffect, useId, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { getConnectedGamepads } from "@/feedback";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { buildBugContext } from "@/lib/telemetry";
import { usePreferences } from "@/store/preferences";

type Category = { id: string; label: string };

type BugPublic = {
  id: string;
  category: string;
  category_label: string;
  description: string;
  status: string;
  created_at: string;
};

function lessonOrGameFromPath(pathname: string): string | null {
  const match = pathname.match(/\/(braille|cursive)\/lessons\/([^/]+)/);
  if (match) return `${match[1]} lesson ${match[2]}`;
  const game = pathname.match(/\/games\/([^/]+)/);
  if (game) return `game ${game[1]}`;
  return null;
}

export function ReportProblemPage() {
  const location = useLocation();
  const settings = usePreferences((s) => s.settings);
  const descId = useId();
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<BugPublic[]>([]);
  const lessonOrGame = lessonOrGameFromPath(location.pathname);

  function currentContext() {
    return buildBugContext({
      settings: {
        theme: settings.theme,
        text_scale: settings.text_scale,
        reduce_motion: settings.reduce_motion,
        reduced_visuals: settings.reduced_visuals,
        volume: settings.volume,
        sfx_enabled: settings.sfx_enabled,
        speech_enabled: settings.speech_enabled,
        haptics_enabled: settings.haptics_enabled,
        handedness: settings.handedness,
      },
      gamepadId: getConnectedGamepads()[0]?.id ?? null,
      lessonOrGame,
    });
  }

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiGet<{ categories: Category[] }>("/api/bugs/categories");
        setCategories(data.categories);
        const reports = await apiGet<BugPublic[]>("/api/bugs/mine");
        setMine(reports);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load report form.");
      }
    })();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!category) {
      setError("Pick a category first.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const report = await apiPost<BugPublic>("/api/bugs", {
        category,
        description,
        context: currentContext(),
      });
      setSuccess("Thanks — the admin will reply in your Inbox.");
      setDescription("");
      setCategory("");
      setMine((prev) => [report, ...prev]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="report-title">
      <h1 id="report-title" className="page-title">
        Report a Problem
      </h1>
      <p className="lede">Three steps: pick a category, optionally describe it, then send.</p>

      {success ? (
        <div className="banner" role="status">
          <strong>{success}</strong>
        </div>
      ) : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <form className="report-form" onSubmit={(event) => void onSubmit(event)}>
        <fieldset className="report-categories">
          <legend className="field-label">1. What went wrong?</legend>
          <div className="choice-grid report-choice-grid">
            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`secondary-button${category === item.id ? " is-selected" : ""}`}
                aria-pressed={category === item.id}
                onClick={() => setCategory(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label className="field-label" htmlFor={descId}>
            2. Optional description
          </label>
          <textarea
            id={descId}
            className="field-input field-textarea"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={4000}
            placeholder="What were you trying to do?"
          />
        </div>

        <details
          className="report-context"
          open={showContext}
          onToggle={(event) => setShowContext((event.target as HTMLDetailsElement).open)}
        >
          <summary className="secondary-button link-button">What we&apos;ll send</summary>
          <pre className="report-context-pre" tabIndex={0}>
            {JSON.stringify(showContext ? currentContext() : {}, null, 2)}
          </pre>
        </details>

        <button type="submit" className="primary-button" disabled={busy || !category}>
          {busy ? "Sending…" : "3. Send"}
        </button>
      </form>

      {mine.length > 0 ? (
        <div className="report-history">
          <h2 className="page-title" style={{ fontSize: "1.25rem" }}>
            Your recent reports
          </h2>
          <ul className="plain-list">
            {mine.slice(0, 5).map((row) => (
              <li key={row.id}>
                <strong>{row.category_label}</strong> — {row.status}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
