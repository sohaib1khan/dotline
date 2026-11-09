import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiGet } from "@/lib/api";
import { homePathFor, learnerHomePath } from "@/lib/homePath";
import { LandingPage } from "@/pages/LandingPage";
import { useAuth } from "@/store/auth";

type BootstrapInfo = { needs_setup: boolean };

export function EntryGatePage() {
  const user = useAuth((s) => s.user);
  const loadingAuth = useAuth((s) => s.loading);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGet<BootstrapInfo>("/api/bootstrap");
        if (!cancelled) setNeedsSetup(data.needs_setup);
      } catch {
        if (!cancelled) setError("Could not reach Dotline. Refresh to try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="app-shell">
        <main className="main-panel" aria-label="Startup error">
          <h1 className="brand">Dotline</h1>
          <p className="field-error" role="alert">
            {error}
          </p>
        </main>
      </div>
    );
  }

  if (needsSetup === null || loadingAuth) {
    return (
      <div className="app-shell">
        <main className="main-panel" aria-busy="true" aria-label="Loading Dotline">
          <h1 className="brand">Dotline</h1>
          <p className="status">Loading…</p>
        </main>
      </div>
    );
  }

  if (needsSetup) {
    return <Navigate to="/setup" replace />;
  }

  if (user?.email_verified_at) {
    if (user.role === "admin") {
      return <Navigate to={homePathFor(user)} replace />;
    }
    return <LearnerHomeRedirect />;
  }

  return <LandingPage />;
}

function LearnerHomeRedirect() {
  const [path, setPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void learnerHomePath(() => apiGet<{ tracks: string[] }>("/api/me/tracks")).then((next) => {
      if (!cancelled) setPath(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!path) {
    return (
      <div className="app-shell">
        <main className="main-panel" aria-busy="true" aria-label="Loading Dotline">
          <h1 className="brand">Dotline</h1>
          <p className="status">Loading…</p>
        </main>
      </div>
    );
  }

  return <Navigate to={path} replace />;
}
