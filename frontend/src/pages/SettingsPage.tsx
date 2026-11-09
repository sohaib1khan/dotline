import { useEffect, useId, useState } from "react";
import { Field, FormStatus, type SubmitHandler } from "@/components/AuthForm";
import { ApiError, apiGet, apiSend } from "@/lib/api";
import type { UserPublic, UserSettings } from "@/lib/types";
import { useAuth } from "@/store/auth";
import { usePreferences } from "@/store/preferences";
import { TEXT_SCALE_OPTIONS, THEME_OPTIONS } from "@/theme/tokens";

type Tab = "account" | "display" | "sound" | "haptics" | "handedness" | "tracks";

const TABS: { id: Tab; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "display", label: "Display" },
  { id: "sound", label: "Sound & Speech" },
  { id: "haptics", label: "Haptics" },
  { id: "handedness", label: "Handedness" },
  { id: "tracks", label: "Tracks" },
];

export function SettingsPage() {
  const formId = useId();
  const [tab, setTab] = useState<Tab>("display");
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const settings = usePreferences((s) => s.settings);
  const hydrate = usePreferences((s) => s.hydrate);
  const setSettings = usePreferences((s) => s.setSettings);

  const [username, setUsername] = useState(user?.username ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiGet<UserSettings>("/api/me/settings")
      .then((data) => hydrate(data))
      .catch(() => undefined);
  }, [hydrate]);

  useEffect(() => {
    setUsername(user?.username ?? "");
  }, [user]);

  async function saveDisplay(partial: Partial<UserSettings>) {
    setBusy(true);
    setError("");
    setMessage("");
    const previous = settings;
    setSettings(partial);
    try {
      const saved = await apiSend<UserSettings>("PATCH", "/api/me/settings", partial);
      hydrate(saved);
      setMessage("Display settings saved.");
    } catch (err) {
      hydrate(previous);
      setError(err instanceof ApiError ? err.message : "Could not save settings.");
    } finally {
      setBusy(false);
    }
  }

  const onAccountSubmit: SubmitHandler = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body: Record<string, string> = {};
      if (username && username !== user?.username) body.username = username;
      if (newPassword) {
        body.current_password = currentPassword;
        body.new_password = newPassword;
        body.confirm_password = confirmPassword;
      }
      const updated = await apiSend<UserPublic>("PATCH", "/api/me/account", body);
      setUser(updated);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Account updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={`${formId}-title`}>
      <h1 id={`${formId}-title`} className="page-title">
        Settings
      </h1>
      <div className="tabs" role="tablist" aria-label="Settings sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className="tab-button"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <FormStatus message={error} />
      {message ? (
        <p className="success-text" role="status">
          {message}
        </p>
      ) : null}

      {tab === "account" ? (
        <form className="settings-form" onSubmit={onAccountSubmit} noValidate>
          <p className="page-copy">
            {user?.first_name} {user?.last_name} · {user?.email}
          </p>
          <Field
            id="settings-username"
            label="Username"
            value={username}
            onChange={setUsername}
            autoComplete="username"
          />
          <Field
            id="settings-current-password"
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            required={false}
          />
          <Field
            id="settings-new-password"
            label="New password"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            required={false}
          />
          <Field
            id="settings-confirm-password"
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            required={false}
          />
          <button className="primary-button" type="submit" disabled={busy}>
            Save account
          </button>
        </form>
      ) : null}

      {tab === "display" ? (
        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            void saveDisplay({
              theme: settings.theme,
              text_scale: settings.text_scale,
              reduce_motion: settings.reduce_motion,
              reduced_visuals: settings.reduced_visuals,
            });
          }}
        >
          <div className="field">
            <label className="field-label" htmlFor="theme">
              Theme
            </label>
            <select
              id="theme"
              className="field-select"
              value={settings.theme}
              onChange={(event) =>
                setSettings({ theme: event.target.value as UserSettings["theme"] })
              }
            >
              {THEME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="text-scale">
              Text size ({settings.text_scale}%)
            </label>
            <select
              id="text-scale"
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
          </div>
          <label className="field-label">
            <input
              type="checkbox"
              checked={settings.reduce_motion}
              onChange={(event) => setSettings({ reduce_motion: event.target.checked })}
            />{" "}
            Reduce motion
          </label>
          <label className="field-label">
            <input
              type="checkbox"
              checked={settings.reduced_visuals}
              onChange={(event) => setSettings({ reduced_visuals: event.target.checked })}
            />{" "}
            Reduced visuals (turn off 3D later)
          </label>
          <button className="primary-button" type="submit" disabled={busy}>
            Save display
          </button>
        </form>
      ) : null}

      {tab === "sound" || tab === "haptics" || tab === "handedness" || tab === "tracks" ? (
        <div className="banner" role="status">
          <strong>{TABS.find((item) => item.id === tab)?.label} controls</strong>
          <p>Structure is in place. Full controls arrive in later phases.</p>
        </div>
      ) : null}
    </section>
  );
}
