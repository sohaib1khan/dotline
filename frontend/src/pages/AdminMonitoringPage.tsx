import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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

function lastDays<T>(rows: T[], count = 14): T[] {
  return rows.length <= count ? rows : rows.slice(rows.length - count);
}

const WIDGET_ORDER = [
  "active_now",
  "dau",
  "active_time",
  "by_track",
  "signups",
  "lessons_completed",
  "top_learners",
  "hardest_lessons",
  "recent_logins",
  "failed_spikes",
  "open_bugs",
] as const;

export function AdminMonitoringPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [layout, setLayout] = useState<Layout[]>([]);
  const [topDays, setTopDays] = useState(7);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [width, setWidth] = useState(900);
  const [compact, setCompact] = useState(false);
  const [busy, setBusy] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

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
    const node = hostRef.current;
    if (!node) return;
    const update = () => {
      const next = Math.max(280, node.clientWidth);
      setWidth(next);
      setCompact(next < 800);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
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
          <p className="monitor-hint">Heartbeat in the last 2 minutes</p>
        </>
      ),
      dau: (
        <>
          <h2>Daily active users</h2>
          <SimpleBars
            items={lastDays(data.dau).map((row) => ({ label: shortDate(row.date), value: row.count }))}
            labelKey="label"
            valueKey="value"
          />
        </>
      ),
      active_time: (
        <>
          <h2>Active time by day</h2>
          <SimpleBars
            items={lastDays(data.active_time).map((row) => ({
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
          <h2>Top learners</h2>
          <div className="admin-segment monitor-range" role="group" aria-label="Range">
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                type="button"
                className={`admin-segment-btn${topDays === days ? " is-selected" : ""}`}
                onClick={() => setTopDays(days)}
              >
                {days}d
              </button>
            ))}
          </div>
          <ul className="monitor-list">
            {data.top_learners.length === 0 ? <li>No activity yet.</li> : null}
            {data.top_learners.map((row) => (
              <li key={row.username}>
                <strong>@{row.username}</strong>
                <span>{formatSeconds(row.active_seconds)}</span>
              </li>
            ))}
          </ul>
        </>
      ),
      signups: (
        <>
          <h2>New sign-ups</h2>
          <SimpleBars
            items={lastDays(data.signups).map((row) => ({
              label: shortDate(row.date),
              value: row.count,
            }))}
            labelKey="label"
            valueKey="value"
          />
        </>
      ),
      lessons_completed: (
        <>
          <h2>Lessons completed</h2>
          <SimpleBars
            items={lastDays(data.lessons_completed).map((row) => ({
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
          <ul className="monitor-list">
            {data.hardest_lessons.length === 0 ? <li>No lesson data yet.</li> : null}
            {data.hardest_lessons.map((row) => (
              <li key={row.title}>
                <strong>{row.title}</strong>
                <span>
                  score {row.avg_score ?? "—"} · {row.avg_attempts} attempts · {row.learners} learners
                </span>
              </li>
            ))}
          </ul>
        </>
      ),
      recent_logins: (
        <>
          <h2>Recent logins</h2>
          <ul className="monitor-list">
            {data.recent_logins.map((row, index) => (
              <li key={`${row.created_at}-${index}`}>
                <strong className={row.success ? "ok" : "fail"}>{row.success ? "OK" : "FAIL"}</strong>
                <span>
                  {row.email_attempted} · {row.ip ?? "—"}
                </span>
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
          <h2>Open bugs</h2>
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
    <section aria-labelledby="monitoring-title" className="admin-page monitoring-page">
      <header className="admin-page-header">
        <div>
          <h1 id="monitoring-title" className="page-title">
            Monitoring
          </h1>
          <p className="page-copy">
            <strong>Live usage and health.</strong>
            {compact ? " Cards stack on this screen size." : " Drag widgets on larger screens."}
          </p>
        </div>
        <div className="admin-toolbar">
          <button type="button" className="secondary-button" disabled={busy} onClick={() => void load()}>
            Refresh
          </button>
          {!compact ? (
            <button type="button" className="secondary-button" disabled={busy} onClick={() => void resetLayout()}>
              Reset layout
            </button>
          ) : null}
          <Link className="secondary-button link-button" to="/admin/monitoring/logins">
            Login log
          </Link>
        </div>
      </header>

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

      <div ref={hostRef} className="monitor-host">
        {!data ? (
          <p className="admin-empty">
            <strong>Loading dashboard…</strong>
          </p>
        ) : compact ? (
          <div className="monitor-stack">
            {WIDGET_ORDER.map((id) =>
              widgets[id] ? (
                <article key={id} className="monitor-widget monitor-widget-static">
                  <div className="monitor-widget-body">{widgets[id]}</div>
                </article>
              ) : null,
            )}
          </div>
        ) : (
          <GridLayout
            className="monitor-grid"
            layout={layout}
            cols={12}
            rowHeight={56}
            width={width}
            margin={[12, 12]}
            containerPadding={[0, 0]}
            draggableHandle=".monitor-drag"
            onDragStop={(next) => void persistLayout(next)}
            onResizeStop={(next) => void persistLayout(next)}
          >
            {layout.map((item) => (
              <div key={item.i} className="monitor-widget">
                <button type="button" className="monitor-drag" aria-label="Drag widget">
                  ⋮⋮
                </button>
                <div className="monitor-widget-body">{widgets[item.i]}</div>
              </div>
            ))}
          </GridLayout>
        )}
      </div>
    </section>
  );
}
