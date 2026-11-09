import { useId, useState, type FormEvent } from "react";
import { ApiError, apiPost } from "@/lib/api";

export function AdminAnnouncementsPage() {
  const titleId = useId();
  const bodyId = useId();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await apiPost<{ message: string; delivered: number }>(
        "/api/admin/announcements",
        { title, body },
      );
      setMessage(result.message);
      setTitle("");
      setBody("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send announcement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="announce-title">
      <h1 id="announce-title" className="page-title">
        Announcements
      </h1>
      <p className="lede">Broadcast a message to every active learner inbox.</p>

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <div className="banner" role="status">
          <strong>{message}</strong>
        </div>
      ) : null}

      <form className="report-form" onSubmit={(event) => void onSubmit(event)}>
        <div className="field">
          <label className="field-label" htmlFor={titleId}>
            Title
          </label>
          <input
            id={titleId}
            className="field-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            minLength={2}
            maxLength={200}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={bodyId}>
            Body
          </label>
          <textarea
            id={bodyId}
            className="field-input field-textarea"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
            minLength={2}
            rows={6}
          />
        </div>
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? "Sending…" : "Send to all inboxes"}
        </button>
      </form>
    </section>
  );
}
