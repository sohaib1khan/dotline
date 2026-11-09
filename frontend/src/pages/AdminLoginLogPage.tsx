import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, apiGet } from "@/lib/api";

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
  const [q, setQ] = useState("");
  const [success, setSuccess] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LoginSearch | null>(null);
  const [error, setError] = useState("");

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

  return (
    <section aria-labelledby="login-log-title">
      <h1 id="login-log-title" className="page-title">
        Login log
      </h1>
      <Link className="secondary-button link-button" to="/admin/monitoring">
        Back to monitoring
      </Link>

      {error ? (
        <p className="field-error" role="alert">
          {error}
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

      {!data ? (
        <p className="lede">Loading…</p>
      ) : (
        <>
          <p className="lede">
            {data.total} events · page {data.page} of {data.pages}
          </p>
          <div className="login-table-wrap" role="region" aria-label="Login events" tabIndex={0}>
            <table className="login-table">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Result</th>
                  <th scope="col">Email / login</th>
                  <th scope="col">IP</th>
                  <th scope="col">Device</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.created_at ? new Date(row.created_at).toLocaleString() : "—"}</td>
                    <td>
                      <strong>{row.success ? "Success" : "Failed"}</strong>
                    </td>
                    <td>{row.email_attempted}</td>
                    <td>{row.ip ?? "—"}</td>
                    <td>{row.device_summary ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cta-row" style={{ justifyContent: "flex-start" }}>
            <button
              type="button"
              className="secondary-button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
