import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AuthShell,
  Field,
  FormStatus,
  PasswordMeter,
  type SubmitHandler,
} from "@/components/AuthForm";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { validatePersonName, validateUsername } from "@/lib/validation";

type SignupStatus = {
  signups_open: boolean;
  email_configured: boolean;
  gate_mode?: "closed" | "admin" | "email" | "open";
  message: string | null;
};

type FieldErrors = Partial<
  Record<"first_name" | "last_name" | "username" | "email" | "password" | "confirm_password", string>
>;

export function SignupPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SignupStatus | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void apiGet<SignupStatus>("/api/auth/signup-status").then(setStatus).catch(() => {
      setStatus({
        signups_open: false,
        email_configured: false,
        gate_mode: "closed",
        message: "Sign-ups are temporarily closed.",
      });
    });
  }, []);

  const onSubmit: SubmitHandler = async (event) => {
    event.preventDefault();
    const next: FieldErrors = {};
    const firstErr = validatePersonName(firstName);
    const lastErr = validatePersonName(lastName);
    const userErr = validateUsername(username);
    if (firstErr) next.first_name = firstErr;
    if (lastErr) next.last_name = lastErr;
    if (userErr) next.username = userErr;
    if (!email.includes("@")) next.email = "Enter a valid email address.";
    if (password.length < 12) next.password = "Password must be at least 12 characters.";
    if (password !== confirmPassword) next.confirm_password = "Passwords do not match.";
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const result = await apiPost<{
        message: string;
        verification_required?: boolean;
        pending_approval?: boolean;
      }>("/api/auth/signup", {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
      });
      if (result.verification_required) {
        navigate("/check-email", { state: { email } });
      } else {
        navigate("/login", { state: { notice: result.message } });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.fieldErrors).length > 0) {
          setErrors(err.fieldErrors as FieldErrors);
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError("Sign-up failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (status && !status.signups_open) {
    return (
      <AuthShell title="Sign up">
        <div className="banner" role="status">
          <strong>{status.message ?? "Sign-ups are temporarily closed."}</strong>
          <p>An admin can open sign-ups later from Admin → Settings.</p>
        </div>
        <p className="auth-links">
          <Link to="/login">Log in</Link>
        </p>
      </AuthShell>
    );
  }

  const gateHint =
    status?.gate_mode === "admin"
      ? "After you sign up, an admin must approve your account before you can log in."
      : status?.gate_mode === "email"
        ? "We will email you a confirmation link so you can finish creating your account."
        : status?.gate_mode === "open"
          ? "You can log in right after creating your account."
          : null;

  return (
    <AuthShell title="Create your account">
      {gateHint ? (
        <div className="banner" role="status">
          <strong>{gateHint}</strong>
        </div>
      ) : null}
      <form className="setup-form" onSubmit={onSubmit} noValidate>
        <Field
          id="first_name"
          label="First name"
          value={firstName}
          onChange={setFirstName}
          error={errors.first_name}
          autoComplete="given-name"
        />
        <Field
          id="last_name"
          label="Last name"
          value={lastName}
          onChange={setLastName}
          error={errors.last_name}
          autoComplete="family-name"
        />
        <Field
          id="username"
          label="Username"
          value={username}
          onChange={setUsername}
          error={errors.username}
          autoComplete="username"
        />
        <Field
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          error={errors.email}
          autoComplete="email"
        />
        <Field
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          autoComplete="new-password"
        />
        <PasswordMeter password={password} />
        <Field
          id="confirm_password"
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={errors.confirm_password}
          autoComplete="new-password"
        />
        <FormStatus message={formError} />
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p className="auth-links">
        <Link to="/login">Already have an account? Log in</Link>
      </p>
    </AuthShell>
  );
}
