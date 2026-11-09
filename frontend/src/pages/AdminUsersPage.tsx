import { useCallback, useEffect, useState } from "react";
import { ApiError, apiGet, apiPost } from "@/lib/api";

type UserSummary = {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  email_verified_at: string | null;
  created_at: string | null;
  last_login_at: string | null;
};

type UserDetail = UserSummary & {
  tracks: string[];
  total_active_seconds: number;
  progress: { total_xp: number; level: number; badges_earned: number };
  login_history: { id: string; success: boolean; created_at: string | null; ip: string | null }[];
  bug_reports: { id: string; category_label: string; status: string }[];
};

export function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [verified, setVerified] = useState("all");
  const [rows, setRows] = useState<UserSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (role !== "all") params.set("role", role);
    if (status !== "all") params.set("status", status);
    if (verified !== "all") params.set("verified", verified);
    const data = await apiGet<UserSummary[]>(`/api/admin/users?${params.toString()}`);
    setRows(data);
  }, [q, role, status, verified]);

  useEffect(() => {
    void loadList().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Could not load users."),
    );
  }, [loadList]);

  async function openUser(id: string) {
    setSelectedId(id);
    setMessage("");
    setConfirmDelete("");
    try {
      setDetail(await apiGet<UserDetail>(`/api/admin/users/${id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load user.");
    }
  }

  async function runAction(path: string, body: unknown, okMessage: string) {
    if (!selectedId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiPost(path, body);
      setMessage(okMessage);
      await loadList();
      setDetail(await apiGet<UserDetail>(`/api/admin/users/${selectedId}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="admin-users-title">
      <h1 id="admin-users-title" className="page-title">
        Users
      </h1>

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

      <div className="admin-filters">
        <div className="field">
          <label className="field-label" htmlFor="user-q">
            Search
          </label>
          <input
            id="user-q"
            className="field-input"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Name, email, username"
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="user-role">
            Role
          </label>
          <select id="user-role" className="field-input field-select" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="all">All</option>
            <option value="learner">Learner</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="user-status">
            Status
          </label>
          <select
            id="user-status"
            className="field-input field-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="user-verified">
            Verified
          </label>
          <select
            id="user-verified"
            className="field-input field-select"
            value={verified}
            onChange={(e) => setVerified(e.target.value)}
          >
            <option value="all">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>

      <div className="inbox-layout">
        <ul className="inbox-list" aria-label="Users">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={`inbox-item${selectedId === row.id ? " is-selected" : ""}`}
                onClick={() => void openUser(row.id)}
              >
                <span className="inbox-item-title">
                  <strong>
                    {row.first_name} {row.last_name}
                  </strong>
                </span>
                <span className="inbox-item-meta">
                  @{row.username} · {row.role} ·{" "}
                  {row.is_active
                    ? "active"
                    : row.last_login_at
                      ? "disabled"
                      : "pending approval"}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <article className="inbox-detail">
          {!detail ? (
            <p className="lede">Select a user.</p>
          ) : (
            <>
              <h2 className="page-title" style={{ fontSize: "1.35rem" }}>
                {detail.first_name} {detail.last_name}
              </h2>
              <p className="lede">
                @{detail.username} · {detail.email} · level {detail.progress.level} ·{" "}
                {detail.total_active_seconds}s active
              </p>
              <p className="lede">
                Tracks: {detail.tracks.length ? detail.tracks.join(", ") : "none"} · Badges{" "}
                {detail.progress.badges_earned} · XP {detail.progress.total_xp}
              </p>

              <div className="cta-row" style={{ justifyContent: "flex-start" }}>
                <button
                  type="button"
                  className={detail.is_active ? "secondary-button" : "primary-button"}
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      `/api/admin/users/${detail.id}/active`,
                      { is_active: !detail.is_active },
                      detail.is_active
                        ? "User disabled."
                        : detail.last_login_at
                          ? "User enabled."
                          : "User approved — they can log in now.",
                    )
                  }
                >
                  {detail.is_active
                    ? "Disable"
                    : detail.last_login_at
                      ? "Enable"
                      : "Approve"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      `/api/admin/users/${detail.id}/role`,
                      { role: detail.role === "admin" ? "learner" : "admin" },
                      "Role updated.",
                    )
                  }
                >
                  Make {detail.role === "admin" ? "learner" : "admin"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      `/api/admin/users/${detail.id}/password-reset`,
                      {},
                      "Password reset emailed.",
                    )
                  }
                >
                  Send password reset
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy || Boolean(detail.email_verified_at)}
                  onClick={() =>
                    void runAction(
                      `/api/admin/users/${detail.id}/resend-verification`,
                      {},
                      "Verification emailed.",
                    )
                  }
                >
                  Resend verification
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      `/api/admin/users/${detail.id}/reset-progress`,
                      { scope: "everything", confirm: "RESET" },
                      "Progress reset.",
                    )
                  }
                >
                  Reset progress
                </button>
              </div>

              <div className="field" style={{ marginTop: "1rem" }}>
                <label className="field-label" htmlFor="delete-user">
                  Delete — type username
                </label>
                <input
                  id="delete-user"
                  className="field-input"
                  value={confirmDelete}
                  onChange={(event) => setConfirmDelete(event.target.value)}
                />
                <button
                  type="button"
                  className="primary-button"
                  disabled={busy || confirmDelete !== detail.username}
                  onClick={() =>
                    void (async () => {
                      setBusy(true);
                      setError("");
                      try {
                        await apiPost(`/api/admin/users/${detail.id}/delete`, {
                          confirm_username: confirmDelete,
                        });
                        setMessage(`Deleted ${detail.username}.`);
                        setDetail(null);
                        setSelectedId(null);
                        await loadList();
                      } catch (err) {
                        setError(err instanceof ApiError ? err.message : "Delete failed.");
                      } finally {
                        setBusy(false);
                      }
                    })()
                  }
                >
                  Delete user
                </button>
              </div>

              <h3 className="field-label">Recent logins</h3>
              <ul className="plain-list">
                {detail.login_history.slice(0, 8).map((row) => (
                  <li key={row.id}>
                    {row.success ? "OK" : "FAIL"} · {row.created_at} · {row.ip ?? "—"}
                  </li>
                ))}
              </ul>

              <h3 className="field-label">Bug reports</h3>
              <ul className="plain-list">
                {detail.bug_reports.length === 0 ? <li>None</li> : null}
                {detail.bug_reports.map((row) => (
                  <li key={row.id}>
                    {row.category_label} — {row.status}
                  </li>
                ))}
              </ul>
            </>
          )}
        </article>
      </div>
    </section>
  );
}
