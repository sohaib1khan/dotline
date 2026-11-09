import type { FormEvent, ReactNode } from "react";
import { BrandMark } from "@/components/BrandMark";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <main className="main-panel setup-panel" aria-label={title}>
        <h1 className="brand brand-with-mark">
          <BrandMark to="/" />
        </h1>
        <p className="status">{title}</p>
        {subtitle ? <p className="lede">{subtitle}</p> : null}
        {children}
      </main>
    </div>
  );
}

export function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
  required = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
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
        required={required}
      />
      {error ? (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormStatus({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="field-error" role="alert">
      {message}
    </p>
  );
}

export function PasswordMeter({ password }: { password: string }) {
  if (!password) return null;
  const lengthOk = password.length >= 12;
  return (
    <p className="meter" aria-live="polite">
      Strength: <strong>{lengthOk ? "Acceptable length" : "Too short (min 12)"}</strong>
      {/[A-Z]/.test(password) && /[a-z]/.test(password) ? " · mixed case" : ""}
      {/\d/.test(password) ? " · number" : ""}
      {/[^A-Za-z0-9]/.test(password) ? " · symbol" : ""}
    </p>
  );
}

export type SubmitHandler = (event: FormEvent<HTMLFormElement>) => void;
