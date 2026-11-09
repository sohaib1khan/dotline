import { useCallback, useEffect, useState } from "react";
import { ApiError, apiGet, apiPost } from "@/lib/api";

type BugPublic = {
  id: string;
  category: string;
  category_label: string;
  description: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  context?: Record<string, unknown>;
};

const STATUSES = ["open", "in_progress", "fixed", "wont_fix"] as const;

export function AdminBugsPage() {
  const [rows, setRows] = useState<BugPublic[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number] | "">("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<BugPublic[]>("/api/admin/bugs");
      setRows(data);
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load bug reports.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  async function sendReply() {
    if (!selected) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const updated = await apiPost<BugPublic>(`/api/admin/bugs/${selected.id}/reply`, {
        reply,
        status: status || null,
      });
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setReply("");
      setStatus("");
      setMessage("Reply sent to the learner inbox.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reply failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="admin-bugs-title">
      <h1 id="admin-bugs-title" className="page-title">
        Bug Reports
      </h1>
      <p className="lede">Reply here to deliver a message to the learner inbox.</p>

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

      <div className="inbox-layout">
        <ul className="inbox-list" aria-label="Bug report queue">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={`inbox-item${selectedId === row.id ? " is-selected" : ""}`}
                onClick={() => {
                  setSelectedId(row.id);
                  setStatus((row.status as (typeof STATUSES)[number]) || "");
                  setMessage("");
                }}
              >
                <span className="inbox-item-title">
                  <strong>{row.category_label}</strong>
                </span>
                <span className="inbox-item-meta">
                  {row.status} · {new Date(row.created_at).toLocaleString()}
                </span>
              </button>
            </li>
          ))}
          {rows.length === 0 ? (
            <li>
              <p className="lede">No bug reports yet.</p>
            </li>
          ) : null}
        </ul>

        <article className="inbox-detail">
          {selected ? (
            <>
              <h2 className="page-title" style={{ fontSize: "1.35rem" }}>
                {selected.category_label}
              </h2>
              <p className="lede">
                Status: {selected.status} · User {selected.user_id?.slice(0, 8)}…
              </p>
              <p className="inbox-body">{selected.description || "(no description)"}</p>

              <details>
                <summary className="secondary-button link-button">Captured context</summary>
                <pre className="report-context-pre" tabIndex={0}>
                  {JSON.stringify(selected.context ?? {}, null, 2)}
                </pre>
              </details>

              <div className="field">
                <label className="field-label" htmlFor="bug-status">
                  Status
                </label>
                <select
                  id="bug-status"
                  className="field-input field-select"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as (typeof STATUSES)[number] | "")}
                >
                  <option value="">Keep current ({selected.status})</option>
                  {STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="bug-reply">
                  Reply to learner
                </label>
                <textarea
                  id="bug-reply"
                  className="field-input field-textarea"
                  rows={4}
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  required
                />
              </div>

              <button
                type="button"
                className="primary-button"
                disabled={busy || reply.trim().length < 2}
                onClick={() => void sendReply()}
              >
                {busy ? "Sending…" : "Reply"}
              </button>
            </>
          ) : (
            <p className="lede">Select a report to inspect and reply.</p>
          )}
        </article>
      </div>
    </section>
  );
}
