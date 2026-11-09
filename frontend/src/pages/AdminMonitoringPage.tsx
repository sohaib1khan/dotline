import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import GridLayout, { type Layout } from "react-grid-layout";
import { Link } from "react-router-dom";
import { SimpleBars } from "@/components/SimpleBars";
import { ApiError, apiGet, apiPost, apiPut } from "@/lib/api";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

type Dashboard = {
  active_now: { count: number };
  dau: { date: string; count: number }[];
  active_time: { date: string; active_seconds: number }[];
  by_track: { track: string; active_seconds: number }[];
  top_learners: { username: string; name: string; active_seconds: number }[];
  top_range_days: number;
  signups: { date: string; count: number }[];
  lessons_completed: { date: string; count: number }[];
  hardest_lessons: {
    title: string;
    avg_score: number | null;
    avg_attempts: number;
    learners: number;
  }[];
  recent_logins: {
    email_attempted: string;
    success: boolean;
    created_at: string | null;
    ip: string | null;
  }[];
  failed_spikes: { hour: string | null; failed: number }[];
  open_bugs: { label: string; count: number }[];
  generated_at: string;
};

function formatSeconds(total: number) {
  const mins = Math.floor(total / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function shortDate(iso: string) {
  return iso.slice(5);
}

export function AdminMonitoringPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [layout, setLayout] = useState<Layout[]>([]);
  const [topDays, setTopDays] = useState(7);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [width, setWidth] = useState(900);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [dashboard, layoutResp] = await Promise.all([
      apiGet<Dashboard>(`/api/admin/monitoring?top_days=${topDays}`),
      apiGet<{ layout: Layout[] }>("/api/admin/monitoring/layout"),
    ]);
    setData(dashboard);
    setLayout(layoutResp.layout);
  }, [topDays]);

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Could not load monitoring."),
    );
  }, [load]);

  useEffect(() => {
    const node = document.querySelector(".panel");
    const update = () => setWidth(Math.max(320, (node?.clientWidth || 900) - 24));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  async function persistLayout(next: Layout[]) {
    setLayout(next);
    try {
      await apiPut("/api/admin/monitoring/layout", { layout: next });
    } catch {
      // Keep local layout if save fails.
    }
  }

  async function resetLayout() {
    setBusy(true);
    setError("");
    try {
      const result = await apiPost<{ layout: Layout[] }>("/api/admin/monitoring/layout/reset", {});
      setLayout(result.layout);
      setMessage("Layout reset.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  }

  const widgets = useMemo((): Record<string, ReactNode> => {
    if (!data) return {};
    return {
      active_now: (
        <>
          <h2>Active now</h2>
          <p className="monitor-stat">{data.active_now.count}</p>
          <p className="lede">Heartbeat in the last 2 minutes.</p>
        </>
      ),
      dau: (
        <>
          <h2>Daily active users</h2>
          <SimpleBars
            items={data.dau.map((row) => ({ label: shortDate(row.date), value: row.count }))}
            labelKey="label"
            valueKey="value"
          />
        </>
      ),
      active_time: (
        <>
          <h2>Active time by day</h2>
          <SimpleBars
            items={data.active_time.map((row) => ({
              label: shortDate(row.date),
              value: row.active_seconds,
            }))}
            labelKey="label"
            valueKey="value"
            formatValue={formatSeconds}
          />
        </>
      ),
      by_track: (
        <>
          <h2>Active time by track</h2>
          <SimpleBars
            items={data.by_track.map((row) => ({
              label: row.track,
              value: row.active_seconds,
            }))}
            labelKey="label"
            valueKey="value"
            formatValue={formatSeconds}
          />
        </>
      ),
      top_learners: (
        <>
          <h2>Top learners ({topDays}d)</h2>
          <div className="cta-row" style={{ justifyContent: "flex-start" }}>
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                type="button"
                className={`secondary-button${topDays === days ? " is-selected" : ""}`}
                onClick={() => setTopDays(days)}
              >
                {days}d
              </button>
            ))}
          </div>
          <ul className="plain-list">
            {data.top_learners.length === 0 ? <li>No activity yet.</li> : null}
            {data.top_learners.map((row) => (
              <li key={row.username}>
                <strong>@{row.username}</strong> — {formatSeconds(row.active_seconds)}
              </li>
            ))}
          </ul>
        </>
      ),
      signups: (
        <>
          <h2>New sign-ups</h2>
          <SimpleBars
            items={data.signups.map((row) => ({ label: shortDate(row.date), value: row.count }))}
            labelKey="label"
            valueKey="value"
          />
        </>
      ),
      lessons_completed: (
        <>
          <h2>Lessons completed</h2>
          <SimpleBars
            items={data.lessons_completed.map((row) => ({
              label: shortDate(row.date),
              value: row.count,
            }))}
            labelKey="label"
            valueKey="value"
          />
        </>
      ),
      hardest_lessons: (
        <>
          <h2>Hardest lessons</h2>
          <ul className="plain-list">
            {data.hardest_lessons.length === 0 ? <li>No lesson data yet.</li> : null}
            {data.hardest_lessons.map((row) => (
              <li key={row.title}>
                <strong>{row.title}</strong> — avg score {row.avg_score ?? "—"}, attempts{" "}
                {row.avg_attempts}, learners {row.learners}
              </li>
            ))}
          </ul>
        </>
      ),
      recent_logins: (
        <>
          <h2>Recent logins</h2>
          <ul className="plain-list">
            {data.recent_logins.map((row, index) => (
              <li key={`${row.created_at}-${index}`}>
                {row.success ? "OK" : "FAIL"} · {row.email_attempted} · {row.ip ?? "—"}
              </li>
            ))}
          </ul>
          <Link className="secondary-button link-button" to="/admin/monitoring/logins">
            Open login log
          </Link>
        </>
      ),
      failed_spikes: (
        <>
          <h2>Failed login spikes</h2>
          <SimpleBars
            items={data.failed_spikes.map((row) => ({
              label: row.hour ? row.hour.slice(5, 16) : "—",
              value: row.failed,
            }))}
            labelKey="label"
            valueKey="value"
          />
        </>
      ),
      open_bugs: (
        <>
          <h2>Open bugs by category</h2>
          <SimpleBars
            items={data.open_bugs.map((row) => ({ label: row.label, value: row.count }))}
            labelKey="label"
            valueKey="value"
          />
        </>
      ),
    };
  }, [data, topDays]);

  return (
    <section aria-labelledby="monitoring-title" className="monitoring-page">
      <h1 id="monitoring-title" className="page-title">
        Monitoring
      </h1>
      <div className="cta-row" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => void load()}>
          Refresh
        </button>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => void resetLayout()}>
          Reset layout
        </button>
        <Link className="secondary-button link-button" to="/admin/monitoring/logins">
          Login log
        </Link>
      </div>

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

      {!data ? (
        <p className="lede">Loading dashboard…</p>
      ) : (
        <GridLayout
          className="monitor-grid"
          layout={layout}
          cols={12}
          rowHeight={48}
          width={width}
          draggableHandle=".monitor-drag"
          onDragStop={(next) => void persistLayout(next)}
          onResizeStop={(next) => void persistLayout(next)}
        >
          {layout.map((item) => (
            <div key={item.i} className="monitor-widget">
              <button type="button" className="monitor-drag secondary-button">
                Move
              </button>
              <div className="monitor-widget-body">{widgets[item.i]}</div>
            </div>
          ))}
        </GridLayout>
      )}
    </section>
  );
}
