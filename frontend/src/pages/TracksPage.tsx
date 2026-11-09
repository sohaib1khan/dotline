import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AuthShell, FormStatus } from "@/components/AuthForm";
import { ApiError, apiGet, apiSend } from "@/lib/api";
import { useAuth } from "@/store/auth";

type TracksResponse = { tracks: string[] };

export function TracksPage() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const loading = useAuth((s) => s.loading);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    void apiGet<TracksResponse>("/api/me/tracks")
      .then((data) => {
        setSelected(new Set(data.tracks));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [user]);

  if (loading) {
    return (
      <AuthShell title="What do you want to learn?">
        <p className="status">Loading…</p>
      </AuthShell>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.email_verified_at) {
    return <Navigate to="/check-email" replace />;
  }

  function toggle(track: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(track)) next.delete(track);
      else next.add(track);
      return next;
    });
  }

  async function save(tracks: string[]) {
    setBusy(true);
    setError("");
    try {
      await apiSend<TracksResponse>("PUT", "/api/me/tracks", { tracks });
      navigate("/app");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save tracks.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="What do you want to learn?"
      subtitle="Pick Braille, Cursive, or both. Next you will choose a room — one calm space at a time."
    >
      {!loaded ? (
        <p className="status">Loading…</p>
      ) : (
        <div className="track-picker" role="group" aria-label="Learning tracks">
          <button
            type="button"
            className={`track-card track-braille${selected.has("braille") ? " is-selected" : ""}`}
            aria-pressed={selected.has("braille")}
            onClick={() => toggle("braille")}
          >
            <span className="track-card-title">Braille</span>
            <span className="track-card-copy">
              English UEB Grade 1 — cells, letters, and reading by touch and sound.
            </span>
          </button>
          <button
            type="button"
            className={`track-card track-cursive${selected.has("cursive") ? " is-selected" : ""}`}
            aria-pressed={selected.has("cursive")}
            onClick={() => toggle("cursive")}
          >
            <span className="track-card-title">Cursive</span>
            <span className="track-card-copy">
              Trace and write flowing letters with clear stroke feedback.
            </span>
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setSelected(new Set(["braille", "cursive"]))}
          >
            Both
          </button>
          <FormStatus message={error} />
          <button
            className="primary-button"
            type="button"
            disabled={busy || selected.size === 0}
            onClick={() => void save([...selected])}
          >
            {busy ? "Saving…" : "Continue to rooms"}
          </button>
        </div>
      )}
    </AuthShell>
  );
}
