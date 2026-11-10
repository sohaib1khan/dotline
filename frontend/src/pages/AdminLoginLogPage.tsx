import { useCallback, useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";

type LoginItem = {
  id: string;
  user_id: string | null;
  email_attempted: string;
  success: boolean;
  ip: string | null;
  device_summary: string | null;
  created_at: string | null;
};

type LoginSearch = {
  items: LoginItem[];
  page: number;
  page_size: number;
  total: number;
  pages: number;
};

export function AdminLoginLogPage() {
  const formId = useId();
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [success, setSuccess] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LoginSearch | null>(null);
  const [selected, setSelected] = useState<LoginItem | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [createEmail, setCreateEmail] = useState("");
  const [createSuccess, setCreateSuccess] = useState(false);
  const [createIp, setCreateIp] = useState("");
  const [createDevice, setCreateDevice] = useState("");

  const [editEmail, setEditEmail] = useState("");
  const [editSuccess, setEditSuccess] = useState(true);
  const [editIp, setEditIp] = useState("");
  const [editDevice, setEditDevice] = useState("");

  const [purgeSuccess, setPurgeSuccess] = useState("fail");
  const [purgeDays, setPurgeDays] = useState("30");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (success !== "all") params.set("success", success);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    params.set("page", String(page));
    params.set("page_size", "25");
    const result = await apiGet<LoginSearch>(`/api/admin/login-events?${params.toString()}`);
    setData(result);
  }, [q, success, dateFrom, dateTo, page]);

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Could not load login log."),
    );
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    setEditEmail(selected.email_attempted);
    setEditSuccess(selected.success);
    setEditIp(selected.ip ?? "");
    setEditDevice(selected.device_summary ?? "");
  }, [selected]);

  async function refresh(notice?: string) {
    setError("");
    if (notice) setMessage(notice);
    await load();
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const created = await apiPost<LoginItem>("/api/admin/login-events", {
        email_attempted: createEmail.trim(),
        success: createSuccess,
        ip: createIp.trim() || null,
        device_summary: createDevice.trim() || null,
      });
      setCreateEmail("");
      setCreateIp("");
      setCreateDevice("");
      setCreateSuccess(false);
      setSelected(created);
      setPage(1);
      await refresh("Login event created.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create login event.");
    } finally {
      setBusy(false);
    }
  }

  async function onUpdate(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const updated = await apiPatch<LoginItem>(`/api/admin/login-events/${selected.id}`, {
        email_attempted: editEmail.trim(),
        success: editSuccess,
        ip: editIp.trim() || null,
        device_summary: editDevice.trim() || null,
        clear_ip: !editIp.trim(),
        clear_device_summary: !editDevice.trim(),
      });
      setSelected(updated);
      await refresh("Login event updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update login event.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiDelete(`/api/admin/login-events/${id}`);
      if (selected?.id === id) setSelected(null);
      await refresh("Login event deleted.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete login event.");
    } finally {
      setBusy(false);
    }
  }

  async function onPurge(event: FormEvent) {
    event.preventDefault();
    const days = Number(purgeDays);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await apiPost<{ deleted: number }>("/api/admin/login-events/purge", {
        success: purgeSuccess,
        older_than_days: Number.isFinite(days) ? days : null,
      });
      setSelected(null);
      await refresh(`Purged ${result.deleted} login event(s).`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not purge login events.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="login-log-title">
      <h1 id="login-log-title" className="page-title">
        Login log
      </h1>
      <div className="cta-row" style={{ justifyContent: "flex-start" }}>
        <Link className="secondary-button link-button" to="/admin/monitoring">
          Back to monitoring
        </Link>
        <Link className="secondary-button link-button" to="/admin/users">
          Users
        </Link>
      </div>

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="status" role="status">
          {message}
        </p>
      ) : null}

      <div className="admin-filters">
        <div className="field">
          <label className="field-label" htmlFor="login-q">
            Search
          </label>
          <input
            id="login-q"
            className="field-input"
            value={q}
            onChange={(event) => {
              setPage(1);
              setQ(event.target.value);
            }}
            placeholder="Email, IP, device"
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="login-success">
            Result
          </label>
          <select
            id="login-success"
            className="field-input field-select"
            value={success}
            onChange={(event) => {
              setPage(1);
              setSuccess(event.target.value);
            }}
          >
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="fail">Fail</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="login-from">
            From
          </label>
          <input
            id="login-from"
            className="field-input"
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setPage(1);
              setDateFrom(event.target.value);
            }}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="login-to">
            To
          </label>
          <input
            id="login-to"
            className="field-input"
            type="date"
            value={dateTo}
            onChange={(event) => {
              setPage(1);
              setDateTo(event.target.value);
            }}
          />
        </div>
      </div>

      <div className="inbox-layout">
        <div className="inbox-list-panel">
          {!data ? (
            <p className="lede">Loading…</p>
          ) : (
            <>
              <p className="lede">
                <strong>
                  {data.total} events · page {data.page} of {data.pages}
                </strong>
              </p>
              <ul className="inbox-list" aria-label="Login events">
                {data.items.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={`inbox-item${selected?.id === row.id ? " is-selected" : ""}`}
                      onClick={() => setSelected(row)}
                    >
                      <span className="inbox-item-title">
                        <strong>
                          {row.success ? "OK" : "FAIL"} · {row.email_attempted}
                        </strong>
                      </span>
                      <span className="inbox-item-meta">
                        {row.created_at ? new Date(row.created_at).toLocaleString() : "—"} ·{" "}
                        {row.ip ?? "no IP"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="cta-row" style={{ justifyContent: "flex-start" }}>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={page <= 1 || busy}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!data || page >= data.pages || busy}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>

        <article className="inbox-detail" aria-label="Login event details">
          <h2 id={`${formId}-edit-title`} className="field-label">
            {selected ? "Edit login event" : "Create / purge"}
          </h2>

          {selected ? (
            <form className="setup-form" onSubmit={onUpdate}>
              <p className="lede">
                <strong>{selected.created_at ? new Date(selected.created_at).toLocaleString() : "—"}</strong>
              </p>
              <div className="field">
                <label className="field-label" htmlFor={`${formId}-edit-email`}>
                  Email / login
                </label>
                <input
                  id={`${formId}-edit-email`}
                  className="field-input"
                  value={editEmail}
                  onChange={(event) => setEditEmail(event.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor={`${formId}-edit-result`}>
                  Result
                </label>
                <select
                  id={`${formId}-edit-result`}
                  className="field-input field-select"
                  value={editSuccess ? "success" : "fail"}
                  onChange={(event) => setEditSuccess(event.target.value === "success")}
                >
                  <option value="fail">Failed</option>
                  <option value="success">Success</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor={`${formId}-edit-ip`}>
                  IP
                </label>
                <input
                  id={`${formId}-edit-ip`}
                  className="field-input"
                  value={editIp}
                  onChange={(event) => setEditIp(event.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor={`${formId}-edit-device`}>
                  Device
                </label>
                <input
                  id={`${formId}-edit-device`}
                  className="field-input"
                  value={editDevice}
                  onChange={(event) => setEditDevice(event.target.value)}
                />
              </div>
              <div className="cta-row" style={{ justifyContent: "flex-start" }}>
                <button className="primary-button" type="submit" disabled={busy}>
                  Save
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => void onDelete(selected.id)}
                >
                  Delete
                </button>
              </div>
            </form>
          ) : (
            <p className="lede">Select a login event to edit, or create / purge below.</p>
          )}

          <h2 id={`${formId}-create-title`} className="field-label">
            Create login event
          </h2>
          <form className="setup-form" onSubmit={onCreate}>
            <div className="field">
              <label className="field-label" htmlFor={`${formId}-create-email`}>
                Email / login
              </label>
              <input
                id={`${formId}-create-email`}
                className="field-input"
                value={createEmail}
                onChange={(event) => setCreateEmail(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`${formId}-create-result`}>
                Result
              </label>
              <select
                id={`${formId}-create-result`}
                className="field-input field-select"
                value={createSuccess ? "success" : "fail"}
                onChange={(event) => setCreateSuccess(event.target.value === "success")}
              >
                <option value="fail">Failed</option>
                <option value="success">Success</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`${formId}-create-ip`}>
                IP
              </label>
              <input
                id={`${formId}-create-ip`}
                className="field-input"
                value={createIp}
                onChange={(event) => setCreateIp(event.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`${formId}-create-device`}>
                Device
              </label>
              <input
                id={`${formId}-create-device`}
                className="field-input"
                value={createDevice}
                onChange={(event) => setCreateDevice(event.target.value)}
              />
            </div>
            <button className="primary-button" type="submit" disabled={busy}>
              Create
            </button>
          </form>

          <h2 id={`${formId}-purge-title`} className="field-label">
            Purge events
          </h2>
          <form className="setup-form" onSubmit={onPurge}>
            <div className="field">
              <label className="field-label" htmlFor={`${formId}-purge-result`}>
                Which
              </label>
              <select
                id={`${formId}-purge-result`}
                className="field-input field-select"
                value={purgeSuccess}
                onChange={(event) => setPurgeSuccess(event.target.value)}
              >
                <option value="fail">Failed only</option>
                <option value="success">Success only</option>
                <option value="all">All</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`${formId}-purge-days`}>
                Older than (days)
              </label>
              <input
                id={`${formId}-purge-days`}
                className="field-input"
                type="number"
                min={0}
                value={purgeDays}
                onChange={(event) => setPurgeDays(event.target.value)}
                required
              />
            </div>
            <button className="primary-button" type="submit" disabled={busy}>
              Purge matching
            </button>
          </form>
        </article>
      </div>
    </section>
  );
}
