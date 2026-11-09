import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell, FormStatus } from "@/components/AuthForm";
import { ApiError, apiGet, apiPost, clearCsrf } from "@/lib/api";
import type { MeResponse, UserSettings } from "@/lib/types";
import { useAuth } from "@/store/auth";
import { usePreferences } from "@/store/preferences";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setUser = useAuth((s) => s.setUser);
  const hydrate = usePreferences((s) => s.hydrate);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("Missing verification token.");
      return;
    }
    void (async () => {
      try {
        const me = await apiPost<MeResponse>("/api/auth/verify-email", { token });
        clearCsrf();
        setUser(me.user);
        try {
          hydrate(await apiGet<UserSettings>("/api/me/settings"));
        } catch {
          // Keep defaults.
        }
        navigate(me.user.role === "admin" ? "/admin" : "/tracks", {
          replace: true,
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Verification failed.");
      }
    })();
  }, [hydrate, navigate, params, setUser]);

  return (
    <AuthShell title="Verifying email">
      {error ? (
        <>
          <FormStatus message={error} />
          <p className="auth-links">
            <Link to="/login">Log in</Link>
          </p>
        </>
      ) : (
        <p className="status">Please wait…</p>
      )}
    </AuthShell>
  );
}
