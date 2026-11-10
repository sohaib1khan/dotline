import { useId, useState } from "react";
import type { FormEvent } from "react";
import { Field, FormStatus } from "@/components/AuthForm";
import { ApiError, apiPatch } from "@/lib/api";
import type { UserPublic } from "@/lib/types";

type Props = {
  /** Extra class on the wrapping form. */
  className?: string;
  onChanged?: () => void;
};

export function ChangePasswordForm({ className = "settings-form", onChanged }: Props) {
  const formId = useId();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 12) {
      setError("New password must be at least 12 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setBusy(true);
    try {
      await apiPatch<UserPublic>("/api/me/account", {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated.");
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={className} onSubmit={(event) => void onSubmit(event)} noValidate>
      <p className="page-copy">
        <strong>Change your own password.</strong> Enter your current password, then choose a new
        one (at least 12 characters).
      </p>
      <FormStatus message={error} />
      {message ? (
        <p className="success-text" role="status">
          {message}
        </p>
      ) : null}
      <Field
        id={`${formId}-current`}
        label="Current password"
        type="password"
        value={currentPassword}
        onChange={setCurrentPassword}
        autoComplete="current-password"
      />
      <Field
        id={`${formId}-new`}
        label="New password"
        type="password"
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
      />
      <Field
        id={`${formId}-confirm`}
        label="Confirm new password"
        type="password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
      />
      <button className="primary-button" type="submit" disabled={busy}>
        {busy ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
