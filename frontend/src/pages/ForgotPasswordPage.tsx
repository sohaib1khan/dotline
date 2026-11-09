import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthShell, Field, FormStatus, type SubmitHandler } from "@/components/AuthForm";
import { ApiError, apiPost } from "@/lib/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit: SubmitHandler = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const result = await apiPost<{ message: string }>("/api/auth/forgot-password", { email });
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Forgot password" subtitle="We will email a one-hour reset link.">
      <form className="setup-form" onSubmit={onSubmit} noValidate>
        <Field
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <FormStatus message={error} />
        {message ? (
          <p className="success-text" role="status">
            {message}
          </p>
        ) : null}
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="auth-links">
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthShell>
  );
}
