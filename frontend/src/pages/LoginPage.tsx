import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell, Field, FormStatus, type SubmitHandler } from "@/components/AuthForm";
import { ApiError, apiPost, clearCsrf } from "@/lib/api";
import type { MeResponse } from "@/lib/types";

export function LoginPage() {
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit: SubmitHandler = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const me = await apiPost<MeResponse>("/api/auth/login", { login, password });
      clearCsrf();
      if (!me.user.email_verified_at) {
        navigate("/check-email");
        return;
      }
      if (me.user.role === "admin") {
        navigate("/admin/settings/email");
        return;
      }
      navigate("/tracks");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Log in">
      <form className="setup-form" onSubmit={onSubmit} noValidate>
        <Field
          id="login"
          label="Email or username"
          value={login}
          onChange={setLogin}
          autoComplete="username"
        />
        <Field
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <FormStatus message={error} />
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Log in"}
        </button>
      </form>
      <p className="auth-links">
        <Link to="/forgot-password">Forgot password?</Link>
        {" · "}
        <Link to="/signup">Sign up</Link>
      </p>
    </AuthShell>
  );
}
