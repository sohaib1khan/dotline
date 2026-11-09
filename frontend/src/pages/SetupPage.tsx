import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import type { MeResponse, UserSettings } from "@/lib/types";
import { useAuth } from "@/store/auth";
import { usePreferences } from "@/store/preferences";

type SetupStatus = { needs_setup: boolean };
type SetupResult = { ok: boolean; redirect_to: string };

type FieldErrors = Partial<
  Record<
    "first_name" | "last_name" | "username" | "email" | "password" | "confirm_password" | "form",
    string
  >
>;

export function SetupPage() {
  const navigate = useNavigate();
  const setUser = useAuth((s) => s.setUser);
  const hydrate = usePreferences((s) => s.hydrate);
  const formId = useId();
  const [loading, setLoading] = useState(true);
  const [gone, setGone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await apiGet<SetupStatus>("/api/setup/status");
        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 404) {
            setGone(true);
          } else {
            setErrors({ form: "Could not reach setup API." });
          }
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FieldErrors = {};

    if (firstName.trim().length < 2) nextErrors.first_name = "First name must be at least 2 characters.";
    if (lastName.trim().length < 2) nextErrors.last_name = "Last name must be at least 2 characters.";
    if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
      nextErrors.username = "Username must be 3–24 letters, numbers, or underscore.";
    }
    if (!email.includes("@")) nextErrors.email = "Enter a valid email address.";
    if (password.length < 12) nextErrors.password = "Password must be at least 12 characters.";
    if (password !== confirmPassword) {
      nextErrors.confirm_password = "Passwords do not match.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const result = await apiPost<SetupResult>("/api/setup/admin", {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
      });
      const me = await apiGet<MeResponse>("/api/auth/me");
      setUser(me.user);
      try {
        hydrate(await apiGet<UserSettings>("/api/me/settings"));
      } catch {
        // Keep defaults.
      }
      navigate(result.redirect_to);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setGone(true);
      } else if (err instanceof ApiError) {
        setErrors({ form: err.message });
      } else {
        setErrors({ form: "Setup failed. Please try again." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="main-panel" aria-busy="true" aria-label="Loading setup">
        <p className="status">Loading setup…</p>
      </main>
    );
  }

  if (gone) {
    return (
      <main className="main-panel" aria-label="Setup unavailable">
        <h1 className="brand">404</h1>
        <p className="status">Setup is no longer available.</p>
      </main>
    );
  }

  return (
    <div className="app-shell">
    <main className="main-panel setup-panel" aria-labelledby={`${formId}-title`}>
      <h1 id={`${formId}-title`} className="brand">
        Dotline
      </h1>
      <p className="status">Create the first admin account</p>

      <form className="setup-form" onSubmit={onSubmit} noValidate>
        <Field
          id={`${formId}-first`}
          label="First name"
          value={firstName}
          onChange={setFirstName}
          error={errors.first_name}
          autoComplete="given-name"
        />
        <Field
          id={`${formId}-last`}
          label="Last name"
          value={lastName}
          onChange={setLastName}
          error={errors.last_name}
          autoComplete="family-name"
        />
        <Field
          id={`${formId}-username`}
          label="Username"
          value={username}
          onChange={setUsername}
          error={errors.username}
          autoComplete="username"
        />
        <Field
          id={`${formId}-email`}
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          error={errors.email}
          autoComplete="email"
        />
        <Field
          id={`${formId}-password`}
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          autoComplete="new-password"
        />
        <Field
          id={`${formId}-confirm`}
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={errors.confirm_password}
          autoComplete="new-password"
        />

        {errors.form ? (
          <p className="field-error" role="alert">
            {errors.form}
          </p>
        ) : null}

        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? "Creating admin…" : "Create admin"}
        </button>
      </form>
    </main>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="field-input"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        required
      />
      {error ? (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
