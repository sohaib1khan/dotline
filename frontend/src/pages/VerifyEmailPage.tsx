import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell, FormStatus } from "@/components/AuthForm";
import { ApiError, apiPost, clearCsrf } from "@/lib/api";
import type { MeResponse } from "@/lib/types";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
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
        navigate(me.user.role === "admin" ? "/admin/settings/email" : "/tracks", { replace: true });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Verification failed.");
      }
    })();
  }, [navigate, params]);

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
