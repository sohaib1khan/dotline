import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, apiGet } from "@/lib/api";

type EmailStatus = {
  configured: boolean;
  has_api_key: boolean;
  from_email: string;
  require_verification: boolean;
  signups_open: boolean;
};

const TOOLS = [
  {
    to: "/admin/settings",
    title: "Settings & Resend",
    copy: "API key, From address, verification, sign-ups, site URL, welcome text.",
    primary: true,
  },
  {
    to: "/admin/content",
    title: "Course content",
    copy: "Edit lessons, download/upload the full YAML course pack.",
  },
  {
    to: "/admin/users",
    title: "Users",
    copy: "Search, disable, reset passwords, resend verification.",
  },
  {
    to: "/admin/monitoring",
    title: "Monitoring",
    copy: "Active time, widgets, and login log.",
  },
  {
    to: "/admin/bugs",
    title: "Bug reports",
    copy: "Triage reports and reply to learner inboxes.",
  },
  {
    to: "/admin/announcements",
    title: "Announcements",
    copy: "Broadcast messages to every learner.",
  },
];

export function AdminDashboardPage() {
  const [email, setEmail] = useState<EmailStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void apiGet<EmailStatus>("/api/admin/settings/email")
      .then(setEmail)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load email status."),
      );
  }, []);

  return (
    <section className="admin-home" aria-labelledby="admin-dash-title">
      <header className="admin-home-header">
        <h1 id="admin-dash-title" className="page-title">
          Admin console
        </h1>
        <p className="page-copy">
          <strong>
            This side is for running Dotline — not for practicing. Learners use rooms and lessons;
            you configure email, content, and users here.
          </strong>
        </p>
      </header>

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <article className="admin-status-card" aria-labelledby="resend-status-title">
        <h2 id="resend-status-title" className="admin-card-title">
          Resend email
        </h2>
        {!email ? (
          <p className="page-copy">
            <strong>Checking configuration…</strong>
          </p>
        ) : (
          <>
            <p className="page-copy">
              <strong>
                {email.configured
                  ? `Configured · ${email.from_email}`
                  : "Not configured yet — paste your Resend API key to send mail."}
              </strong>
            </p>
            <p className="meter">
              Sign-ups: <strong>{email.signups_open ? "open" : "closed"}</strong>
              {email.configured
                ? ` · verification ${email.require_verification ? "on" : "off"}`
                : " · new sign-ups wait for admin approval until Resend is set"}
            </p>
            <div className="cta-row" style={{ justifyContent: "flex-start" }}>
              <Link className="primary-button link-button" to="/admin/settings">
                Open Resend settings
              </Link>
              <Link className="secondary-button link-button" to="/admin/settings/email">
                Email page only
              </Link>
            </div>
          </>
        )}
      </article>

      <div className="admin-tool-grid">
        {TOOLS.map((item) => (
          <article
            key={item.to}
            className={`admin-tool-card${item.primary ? " is-primary" : ""}`}
            aria-labelledby={`tool-${item.to}`}
          >
            <h2 id={`tool-${item.to}`} className="admin-card-title">
              {item.title}
            </h2>
            <p className="page-copy">{item.copy}</p>
            <Link
              className={`${item.primary ? "primary-button" : "secondary-button"} link-button`}
              to={item.to}
            >
              Open {item.title.split(" ")[0]}
            </Link>
          </article>
        ))}
      </div>

      <p className="admin-home-foot">
        <Link className="linkish" to="/app">
          Preview learner rooms
        </Link>
        <span aria-hidden="true"> · </span>
        need a way back? use <strong>Admin console</strong> in the learner nav.
      </p>
    </section>
  );
}
