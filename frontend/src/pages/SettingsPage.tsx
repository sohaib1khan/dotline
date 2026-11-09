import { useEffect, useId, useState } from "react";
import { Field, FormStatus, type SubmitHandler } from "@/components/AuthForm";
import { InstallAppCard } from "@/components/InstallAppCard";
import { feedback, getConnectedGamepads, getVoices, setGamepadMapping } from "@/feedback";
import { ApiError, apiGet, apiSend } from "@/lib/api";
import type { UserPublic, UserSettings } from "@/lib/types";
import { DEFAULT_GAMEPAD_MAPPING, type GamepadMapping } from "@/input/mapping";
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

function TracksSettingsTab() {
  const [tracks, setTracks] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiGet<{ tracks: string[] }>("/api/me/tracks")
      .then((data) => setTracks(data.tracks))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load tracks."));
  }, []);

  async function save(next: string[]) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await apiSend<{ tracks: string[] }>("PUT", "/api/me/tracks", { tracks: next });
      setTracks(data.tracks);
      setMessage("Tracks updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update tracks.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(track: string) {
    const has = tracks.includes(track);
    if (has && tracks.length === 1) {
      setError("Keep at least one track enrolled.");
      return;
    }
    const next = has ? tracks.filter((t) => t !== track) : [...tracks, track];
    void save(next);
  }

  return (
    <div className="settings-form">
      <p className="page-copy">
        <strong>Add or remove learning tracks.</strong> You need at least one.
      </p>
      <label className="field-label">
        <input
          type="checkbox"
          checked={tracks.includes("braille")}
          disabled={busy}
          onChange={() => toggle("braille")}
        />{" "}
        Braille
      </label>
      <label className="field-label">
        <input
          type="checkbox"
          checked={tracks.includes("cursive")}
          disabled={busy}
          onChange={() => toggle("cursive")}
        />{" "}
        Cursive
      </label>
      <FormStatus message={error} />
      {message ? (
        <p className="success-text" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

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

  const [voices, setVoices] = useState(() => getVoices());

  useEffect(() => {
    void apiGet<UserSettings>("/api/me/settings")
      .then((data) => {
        hydrate(data);
        feedback.setVoice(data.speech_voice);
        if (data.gamepad_mapping) {
          setGamepadMapping({ ...DEFAULT_GAMEPAD_MAPPING, ...(data.gamepad_mapping as GamepadMapping) });
        }
      })
      .catch(() => undefined);
  }, [hydrate]);

  useEffect(() => {
    const refresh = () => setVoices(getVoices());
    refresh();
    window.speechSynthesis?.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", refresh);
  }, []);

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

      <InstallAppCard />

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
            Reduced visuals (turn off 3D)
          </label>
          <button className="primary-button" type="submit" disabled={busy}>
            Save display
          </button>
        </form>
      ) : null}

      {tab === "sound" ? (
        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            feedback.setVoice(settings.speech_voice);
            void saveDisplay({
              volume: settings.volume,
              sfx_enabled: settings.sfx_enabled,
              speech_enabled: settings.speech_enabled,
              speech_rate: settings.speech_rate,
              speech_voice: settings.speech_voice,
            });
          }}
        >
          <label className="field-label" htmlFor="volume">
            Master volume ({Math.round(settings.volume * 100)}%)
          </label>
          <input
            id="volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            onChange={(event) => setSettings({ volume: Number(event.target.value) })}
          />
          <label className="field-label">
            <input
              type="checkbox"
              checked={settings.sfx_enabled}
              onChange={(event) => setSettings({ sfx_enabled: event.target.checked })}
            />{" "}
            Sound effects on
          </label>
          <label className="field-label">
            <input
              type="checkbox"
              checked={settings.speech_enabled}
              onChange={(event) => setSettings({ speech_enabled: event.target.checked })}
            />{" "}
            Speech on
          </label>
          <label className="field-label" htmlFor="speech-rate">
            Speech rate ({settings.speech_rate.toFixed(1)}x)
          </label>
          <input
            id="speech-rate"
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={settings.speech_rate}
            onChange={(event) => setSettings({ speech_rate: Number(event.target.value) })}
          />
          <div className="field">
            <label className="field-label" htmlFor="speech-voice">
              Voice
            </label>
            <select
              id="speech-voice"
              className="field-select"
              value={settings.speech_voice ?? ""}
              onChange={(event) =>
                setSettings({ speech_voice: event.target.value ? event.target.value : null })
              }
            >
              <option value="">System default</option>
              {voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              feedback.speak("Dotline speech is working. Pick a natural voice if this still sounds robotic.")
            }
          >
            Test speech
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => feedback.correct("Soft sound test")}
          >
            Test soft sound
          </button>
          <button className="primary-button" type="submit" disabled={busy}>
            Save sound & speech
          </button>
        </form>
      ) : null}

      {tab === "haptics" ? (
        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            const mapping = (settings.gamepad_mapping as GamepadMapping | null) ?? DEFAULT_GAMEPAD_MAPPING;
            setGamepadMapping({ ...DEFAULT_GAMEPAD_MAPPING, ...mapping });
            void saveDisplay({
              haptics_enabled: settings.haptics_enabled,
              haptics_intensity: settings.haptics_intensity,
              gamepad_mapping: mapping as unknown as Record<string, unknown>,
            });
          }}
        >
          {feedback.isIphoneSafari() ? (
            <div className="banner" role="status">
              <strong>Vibration is not available in iPhone Safari.</strong>
              <p>Controller rumble can still work if a gamepad is connected.</p>
            </div>
          ) : (
            <>
              <label className="field-label">
                <input
                  type="checkbox"
                  checked={settings.haptics_enabled}
                  onChange={(event) => setSettings({ haptics_enabled: event.target.checked })}
                />{" "}
                Vibration / haptics on
              </label>
              <label className="field-label" htmlFor="haptics-intensity">
                Intensity ({Math.round(settings.haptics_intensity * 100)}%)
              </label>
              <input
                id="haptics-intensity"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.haptics_intensity}
                onChange={(event) => setSettings({ haptics_intensity: Number(event.target.value) })}
              />
              <button
                className="secondary-button"
                type="button"
                onClick={() => feedback.testVibration()}
                disabled={!feedback.supportsPhoneVibration()}
              >
                Test vibration
              </button>
            </>
          )}
          <p className="meter">
            Controller:{" "}
            {getConnectedGamepads()[0]?.id ?? "none detected"}
          </p>
          <button className="secondary-button" type="button" onClick={() => feedback.testRumble()}>
            Test rumble
          </button>
          <h2 className="demo-title">Controller remapping</h2>
          <p className="meter">
            <strong>Assign gamepad button indices to braille dots 1–6.</strong>
          </p>
          {[1, 2, 3, 4, 5, 6].map((dot) => {
            const mapping =
              (settings.gamepad_mapping as GamepadMapping | null) ?? DEFAULT_GAMEPAD_MAPPING;
            const current =
              Object.entries(mapping.dots).find(([, value]) => value === dot)?.[0] ??
              String(
                Object.entries(DEFAULT_GAMEPAD_MAPPING.dots).find(([, value]) => value === dot)?.[0] ??
                  0,
              );
            return (
              <div className="field" key={dot}>
                <label className="field-label" htmlFor={`dot-map-${dot}`}>
                  Dot {dot} button index
                </label>
                <select
                  id={`dot-map-${dot}`}
                  className="field-select"
                  value={current}
                  onChange={(event) => {
                    const button = Number(event.target.value);
                    const base = {
                      ...DEFAULT_GAMEPAD_MAPPING,
                      ...((settings.gamepad_mapping as GamepadMapping | null) ?? {}),
                      dots: {
                        ...DEFAULT_GAMEPAD_MAPPING.dots,
                        ...((settings.gamepad_mapping as GamepadMapping | null)?.dots ?? {}),
                      },
                    };
                    const nextDots: Record<number, number> = {};
                    for (const [key, value] of Object.entries(base.dots)) {
                      if (value !== dot) nextDots[Number(key)] = value;
                    }
                    nextDots[button] = dot;
                    setSettings({
                      gamepad_mapping: { ...base, dots: nextDots } as unknown as Record<
                        string,
                        unknown
                      >,
                    });
                  }}
                >
                  {Array.from({ length: 16 }, (_, index) => (
                    <option key={index} value={index}>
                      Button {index}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              setSettings({
                gamepad_mapping: DEFAULT_GAMEPAD_MAPPING as unknown as Record<string, unknown>,
              })
            }
          >
            Reset mapping to defaults
          </button>
          <button className="primary-button" type="submit" disabled={busy}>
            Save haptics & mapping
          </button>
        </form>
      ) : null}

      {tab === "handedness" ? (
        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            void saveDisplay({ handedness: settings.handedness });
          }}
        >
          <label className="field-label">
            <input
              type="radio"
              name="handedness"
              checked={settings.handedness === "right"}
              onChange={() => setSettings({ handedness: "right" })}
            />{" "}
            Right-handed
          </label>
          <label className="field-label">
            <input
              type="radio"
              name="handedness"
              checked={settings.handedness === "left"}
              onChange={() => setSettings({ handedness: "left" })}
            />{" "}
            Left-handed
          </label>
          <button className="primary-button" type="submit" disabled={busy}>
            Save handedness
          </button>
        </form>
      ) : null}

      {tab === "tracks" ? <TracksSettingsTab /> : null}
    </section>
  );
}
