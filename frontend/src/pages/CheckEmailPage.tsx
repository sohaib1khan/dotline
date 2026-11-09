import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthShell, FormStatus } from "@/components/AuthForm";
import { ApiError, apiPost } from "@/lib/api";

export function CheckEmailPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await apiPost<{ message: string }>("/api/auth/resend-verification", {});
      setMessage(result.message);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not resend. Log in first if you are not signed in.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Check your email"
      subtitle="We sent a verification link. Open it to activate your account."
    >
      <div className="banner" role="status">
        <strong>Your account is not verified yet.</strong>
        <p>You can log in, but you will stay on this screen until you verify.</p>
      </div>
      <FormStatus message={error} />
      {message ? (
        <p className="success-text" role="status">
          {message}
        </p>
      ) : null}
      <button className="primary-button" type="button" onClick={() => void resend()} disabled={busy}>
        {busy ? "Sending…" : "Resend verification link"}
      </button>
      <p className="auth-links">
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthShell>
  );
}
