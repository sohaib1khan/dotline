import { useEffect, useState, type FormEvent } from "react";
import { AdminEmailPanel } from "@/components/AdminEmailPanel";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { ApiError, apiGet, apiPut } from "@/lib/api";
import { useAuth } from "@/store/auth";

type Tab = "account" | "general" | "signups" | "email";

type GeneralSettings = {
  app_name: string;
  default_daily_goal_minutes: number;
  support_email: string;
  public_base_url: string;
  welcome_message: string;
  signups_open: boolean;
};

export function AdminSettingsHubPage() {
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState<Tab>("account");
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
        default_daily_goal_minutes: Number(general.default_daily_goal_minutes),
        support_email: general.support_email || null,
        public_base_url: general.public_base_url || null,
        welcome_message: general.welcome_message || null,
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
      <p className="page-copy">
        <strong>Your admin account and site configuration.</strong> Change your password here, then
        tune Resend, sign-ups, and site defaults. Changes apply right away.
      </p>

      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {(
          [
            ["account", "My password"],
            ["email", "Resend email"],
            ["general", "General"],
            ["signups", "Sign-ups"],
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

      {tab === "account" ? (
        <div className="settings-form">
          <p className="lede">
            Signed in as <strong>{user?.email ?? user?.username}</strong>
          </p>
          <ChangePasswordForm onChanged={() => setMessage("Password updated.")} />
        </div>
      ) : null}

      {tab === "email" ? (
        <AdminEmailPanel
          onSaved={() => setMessage("Email settings updated.")}
        />
      ) : null}

      {tab === "general" && general ? (
        <form className="settings-form" onSubmit={(event) => void saveGeneral(event)}>
          <p className="lede">
            <strong>Tune the site for your learners.</strong> Daily goal can be any length from 1 to
            180 minutes.
          </p>
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
          <div className="field">
            <label className="field-label" htmlFor="daily-goal">
              Default daily goal (minutes)
            </label>
            <input
              id="daily-goal"
              className="field-input"
              type="number"
              min={1}
              max={180}
              step={1}
              value={general.default_daily_goal_minutes}
              onChange={(event) =>
                setGeneral({
                  ...general,
                  default_daily_goal_minutes: Number(event.target.value),
                })
              }
              required
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="support-email">
              Support / contact email (optional)
            </label>
            <input
              id="support-email"
              className="field-input"
              type="email"
              value={general.support_email}
              onChange={(event) => setGeneral({ ...general, support_email: event.target.value })}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="public-url">
              Public site URL (used in email links)
            </label>
            <input
              id="public-url"
              className="field-input"
              type="url"
              placeholder="https://dotline.example.com"
              value={general.public_base_url}
              onChange={(event) => setGeneral({ ...general, public_base_url: event.target.value })}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="welcome-message">
              Door chooser welcome line
            </label>
            <textarea
              id="welcome-message"
              className="field-input"
              rows={3}
              value={general.welcome_message}
              onChange={(event) => setGeneral({ ...general, welcome_message: event.target.value })}
            />
          </div>
          <button type="submit" className="primary-button" disabled={busy}>
            Save general
          </button>
        </form>
      ) : null}

      {tab === "signups" ? (
        <div className="settings-form">
          <p className="lede">
            <strong>Open or close new learner accounts</strong> without touching the database.
          </p>
          <div className="cta-row" style={{ justifyContent: "flex-start" }}>
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
          </div>
          <button type="button" className="primary-button" disabled={busy} onClick={() => void saveSignups()}>
            Save sign-ups
          </button>
        </div>
      ) : null}
    </section>
  );
}
