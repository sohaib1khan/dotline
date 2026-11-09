import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AuthShell,
  Field,
  FormStatus,
  PasswordMeter,
  type SubmitHandler,
} from "@/components/AuthForm";
import { ApiError, apiPost } from "@/lib/api";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit: SubmitHandler = async (event) => {
    event.preventDefault();
    if (!token) {
      setError("Missing reset token.");
      return;
    }
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await apiPost("/api/auth/reset-password", {
        token,
        password,
        confirm_password: confirmPassword,
      });
      navigate("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reset failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Choose a new password">
      <form className="setup-form" onSubmit={onSubmit} noValidate>
        <Field
          id="password"
          label="New password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <PasswordMeter password={password} />
        <Field
          id="confirm_password"
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
        />
        <FormStatus message={error} />
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Update password"}
        </button>
      </form>
      <p className="auth-links">
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthShell>
  );
}
