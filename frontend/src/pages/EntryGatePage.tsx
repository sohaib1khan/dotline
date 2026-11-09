import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiGet } from "@/lib/api";

type BootstrapInfo = { needs_setup: boolean };

export function EntryGatePage() {
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

  if (needsSetup === null) {
    return (
      <div className="app-shell">
        <main className="main-panel" aria-busy="true" aria-label="Loading Dotline">
          <h1 className="brand">Dotline</h1>
          <p className="status">Loading…</p>
        </main>
      </div>
    );
  }

  return <Navigate to={needsSetup ? "/setup" : "/login"} replace />;
}
