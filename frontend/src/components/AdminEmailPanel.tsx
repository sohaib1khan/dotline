import { useEffect, useState, type FormEvent } from "react";
import { Field, FormStatus } from "@/components/AuthForm";
import { ApiError, apiGet, apiPost, apiPut } from "@/lib/api";

export type EmailSettings = {
  configured: boolean;
  has_api_key: boolean;
  api_key_masked: string | null;
  from_name: string;
  from_email: string;
  reply_to: string;
  require_verification: boolean;
  public_base_url: string;
  signups_open: boolean;
};

type Props = {
  onSaved?: (settings: EmailSettings) => void;
};

export function AdminEmailPanel({ onSaved }: Props) {
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [publicBaseUrl, setPublicBaseUrl] = useState("");
  const [requireVerification, setRequireVerification] = useState(true);
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
        setReplyTo(data.reply_to || "");
        setPublicBaseUrl(data.public_base_url || "");
        setRequireVerification(data.require_verification);
        setReplacingKey(!data.has_api_key);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load email settings.");
      }
    })();
  }, []);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const data = await apiPut<EmailSettings>("/api/admin/settings/email", {
        from_name: fromName,
        from_email: fromEmail,
        reply_to: replyTo || null,
        public_base_url: publicBaseUrl || null,
        require_verification: requireVerification,
        api_key: replacingKey ? apiKey : null,
        replace_api_key: replacingKey && Boolean(apiKey),
        clear_api_key: false,
      });
      setSettings(data);
      setApiKey("");
      setReplacingKey(false);
      setSuccess(
        data.configured
          ? data.require_verification
            ? "Resend saved. New sign-ups confirm themselves by email."
            : "Resend saved. New accounts auto-confirm and can log in right away."
          : "From address saved. Until Resend is fully configured, new sign-ups wait for admin approval.",
      );
      onSaved?.(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function clearKey() {
    if (!settings?.has_api_key) return;
    const ok = window.confirm(
      "Remove the Resend API key? Dotline will stop sending email until you add a new key.",
    );
    if (!ok) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const data = await apiPut<EmailSettings>("/api/admin/settings/email", {
        from_name: fromName || settings.from_name || "Dotline",
        from_email: fromEmail || settings.from_email || "noreply@example.com",
        reply_to: replyTo || null,
        public_base_url: publicBaseUrl || null,
        require_verification: false,
        clear_api_key: true,
        replace_api_key: false,
        api_key: null,
      });
      setSettings(data);
      setReplacingKey(true);
      setApiKey("");
      setRequireVerification(false);
      setSuccess(
        "Resend API key removed. New sign-ups will wait for admin approval until you add a key again.",
      );
      onSaved?.(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not clear the API key.");
    } finally {
      setBusy(false);
    }
  }

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

  if (!settings) {
    return <p className="page-copy"><strong>{error || "Loading Resend settings…"}</strong></p>;
  }

  return (
    <form className="settings-form" onSubmit={(event) => void onSave(event)} noValidate>
      <div className="banner" role="status">
        <strong>Configure Resend here — no env file needed for day-to-day changes.</strong>
        <p>
          With Resend working, learners can confirm themselves by email (or auto-confirm if you turn
          verification off). Without Resend, new accounts wait for an admin to approve them in Users.
        </p>
      </div>

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
      <Field
        id="reply_to"
        label="Reply-to email (optional)"
        type="email"
        value={replyTo}
        onChange={setReplyTo}
        autoComplete="email"
        required={false}
      />
      <Field
        id="public_base_url"
        label="Public site URL for email links"
        value={publicBaseUrl}
        onChange={setPublicBaseUrl}
        autoComplete="url"
        required={false}
      />

      {settings.has_api_key && !replacingKey ? (
        <div className="field">
          <p className="field-label">Resend API key</p>
          <p className="masked-key">
            <strong>{settings.api_key_masked}</strong>
          </p>
          <div className="cta-row" style={{ justifyContent: "flex-start" }}>
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
            <button className="secondary-button" type="button" disabled={busy} onClick={() => void clearKey()}>
              Remove key
            </button>
          </div>
        </div>
      ) : (
        <Field
          id="api_key"
          label="Resend API key"
          type="password"
          value={apiKey}
          onChange={setApiKey}
          autoComplete="off"
          required={!settings.has_api_key}
        />
      )}

      <label className="field-label">
        <input
          type="checkbox"
          checked={requireVerification}
          disabled={!settings.has_api_key && !apiKey}
          onChange={(event) => setRequireVerification(event.target.checked)}
        />{" "}
        Require email verification for new sign-ups
      </label>

      <p className="meter" aria-live="polite">
        Status:{" "}
        <strong>
          {settings.configured
            ? requireVerification
              ? "Configured · learners confirm by email"
              : "Configured · auto-confirm (no email step)"
            : "Not configured · new sign-ups need admin approval"}
        </strong>
      </p>

      <FormStatus message={error} />
      {success ? (
        <p className="success-text" role="status">
          {success}
        </p>
      ) : null}

      <div className="cta-row" style={{ justifyContent: "flex-start" }}>
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "Working…" : "Save Resend settings"}
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => void sendTest()}
          disabled={busy || !settings.has_api_key}
        >
          Send test email to me
        </button>
      </div>
    </form>
  );
}
