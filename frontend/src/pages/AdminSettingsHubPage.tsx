import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError, apiGet, apiPut } from "@/lib/api";

type Tab = "general" | "signups" | "email";

type GeneralSettings = {
  app_name: string;
  default_daily_goal_minutes: 5 | 10 | 20;
  signups_open: boolean;
};

export function AdminSettingsHubPage() {
  const [tab, setTab] = useState<Tab>("general");
  const [general, setGeneral] = useState<GeneralSettings | null>(null);
  const [signupsOpen, setSignupsOpen] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiGet<GeneralSettings>("/api/admin/settings/general");
        setGeneral(data);
        setSignupsOpen(data.signups_open);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load settings.");
      }
    })();
  }, []);

  async function saveGeneral(event: FormEvent) {
    event.preventDefault();
    if (!general) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await apiPut<GeneralSettings>("/api/admin/settings/general", {
        app_name: general.app_name,
        default_daily_goal_minutes: general.default_daily_goal_minutes,
      });
      setGeneral(saved);
      setMessage("General settings saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSignups() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await apiPut<{ signups_open: boolean }>("/api/admin/settings/signups", {
        signups_open: signupsOpen,
      });
      setSignupsOpen(saved.signups_open);
      setMessage(saved.signups_open ? "Sign-ups are open." : "Sign-ups are closed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="admin-settings-title">
      <h1 id="admin-settings-title" className="page-title">
        Settings
      </h1>

      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {(
          [
            ["general", "General"],
            ["signups", "Sign-ups"],
            ["email", "Email"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`secondary-button${tab === id ? " is-selected" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <div className="banner" role="status">
          <strong>{message}</strong>
        </div>
      ) : null}

      {tab === "general" && general ? (
        <form className="report-form" onSubmit={(event) => void saveGeneral(event)}>
          <div className="field">
            <label className="field-label" htmlFor="app-name">
              App display name
            </label>
            <input
              id="app-name"
              className="field-input"
              value={general.app_name}
              onChange={(event) => setGeneral({ ...general, app_name: event.target.value })}
              required
            />
          </div>
          <fieldset className="report-categories">
            <legend className="field-label">Default daily goal (minutes)</legend>
            <div className="choice-grid">
              {([5, 10, 20] as const).map((mins) => (
                <button
                  key={mins}
                  type="button"
                  className={`secondary-button${
                    general.default_daily_goal_minutes === mins ? " is-selected" : ""
                  }`}
                  aria-pressed={general.default_daily_goal_minutes === mins}
                  onClick={() => setGeneral({ ...general, default_daily_goal_minutes: mins })}
                >
                  {mins}
                </button>
              ))}
            </div>
          </fieldset>
          <button type="submit" className="primary-button" disabled={busy}>
            Save general
          </button>
        </form>
      ) : null}

      {tab === "signups" ? (
        <div className="report-form">
          <p className="lede">Close sign-ups to stop new learner accounts.</p>
          <button
            type="button"
            className={`secondary-button${signupsOpen ? " is-selected" : ""}`}
            aria-pressed={signupsOpen}
            onClick={() => setSignupsOpen(true)}
          >
            Open
          </button>
          <button
            type="button"
            className={`secondary-button${!signupsOpen ? " is-selected" : ""}`}
            aria-pressed={!signupsOpen}
            onClick={() => setSignupsOpen(false)}
          >
            Closed
          </button>
          <button type="button" className="primary-button" disabled={busy} onClick={() => void saveSignups()}>
            Save sign-ups
          </button>
        </div>
      ) : null}

      {tab === "email" ? (
        <div className="banner" role="status">
          <strong>Resend email settings</strong>
          <p>
            Configure the API key and From address on the dedicated email page.{" "}
            <Link className="secondary-button link-button" to="/admin/settings/email">
              Open email settings
            </Link>
          </p>
        </div>
      ) : null}
    </section>
  );
}
