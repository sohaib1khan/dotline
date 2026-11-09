import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Field, FormStatus, type SubmitHandler } from "@/components/AuthForm";
import { ApiError, apiGet, apiPost, apiPut } from "@/lib/api";

type EmailSettings = {
  configured: boolean;
  has_api_key: boolean;
  api_key_masked: string | null;
  from_name: string;
  from_email: string;
  signups_open: boolean;
};

export function AdminEmailSettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [replacingKey, setReplacingKey] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiGet<EmailSettings>("/api/admin/settings/email");
        setSettings(data);
        setFromName(data.from_name);
        setFromEmail(data.from_email);
        setReplacingKey(!data.has_api_key);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          navigate("/login");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Could not load settings.");
      }
    })();
  }, [navigate]);

  const onSave: SubmitHandler = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const data = await apiPut<EmailSettings>("/api/admin/settings/email", {
        from_name: fromName,
        from_email: fromEmail,
        api_key: replacingKey ? apiKey : null,
        replace_api_key: replacingKey,
      });
      setSettings(data);
      setApiKey("");
      setReplacingKey(false);
      setSuccess("Email settings saved. New sign-ups will require email verification.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  async function sendTest() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiPost<{ ok: boolean; message: string }>(
        "/api/admin/settings/email/test",
        {},
      );
      if (result.ok) setSuccess(result.message);
      else setError(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Test email failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="admin-email-title">
      <h1 id="admin-email-title" className="page-title">
        Settings → Email
      </h1>

      <div className="banner" role="status">
        <strong>Resend email can be configured here whenever you are ready.</strong>
        <p>
          Learner sign-ups work without email; accounts are auto-verified until Resend is
          configured. After you save a key and From address, new sign-ups require email
          verification. The key is encrypted at rest and never shown in full again after saving.
        </p>
      </div>

      {!settings ? (
        <p className="page-copy">Loading…</p>
      ) : (
        <form className="settings-form" onSubmit={onSave} noValidate>
          <Field
            id="from_name"
            label="From name"
            value={fromName}
            onChange={setFromName}
            autoComplete="organization"
          />
          <Field
            id="from_email"
            label="From email (must be allowed in Resend)"
            type="email"
            value={fromEmail}
            onChange={setFromEmail}
            autoComplete="email"
          />

          {settings.has_api_key && !replacingKey ? (
            <div className="field">
              <p className="field-label">Resend API key</p>
              <p className="masked-key">
                <strong>{settings.api_key_masked}</strong>
              </p>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setReplacingKey(true);
                  setApiKey("");
                }}
              >
                Replace key
              </button>
            </div>
          ) : (
            <Field
              id="api_key"
              label="Resend API key"
              type="password"
              value={apiKey}
              onChange={setApiKey}
              autoComplete="off"
            />
          )}

          <p className="meter" aria-live="polite">
            Status:{" "}
            <strong>
              {settings.configured
                ? settings.signups_open
                  ? "Configured · sign-ups open (verification required)"
                  : "Configured · sign-ups closed"
                : settings.signups_open
                  ? "Not configured · sign-ups open (auto-verify)"
                  : "Not configured · sign-ups closed"}
            </strong>
          </p>

          <FormStatus message={error} />
          {success ? (
            <p className="success-text" role="status">
              {success}
            </p>
          ) : null}

          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Working…" : "Save"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void sendTest()}
            disabled={busy || !settings.has_api_key}
          >
            Send test email
          </button>
        </form>
      )}
    </section>
  );
}
