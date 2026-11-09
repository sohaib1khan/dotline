import { Link } from "react-router-dom";

const LINKS = [
  { to: "/admin/users", title: "Users", copy: "Search, disable, reset, and delete accounts." },
  { to: "/admin/content", title: "Content", copy: "Edit units and lessons for both tracks." },
  { to: "/admin/bugs", title: "Bug reports", copy: "Triage reports and reply to inboxes." },
  { to: "/admin/announcements", title: "Announcements", copy: "Broadcast to every learner." },
  { to: "/admin/settings", title: "Settings", copy: "General, sign-ups, and email." },
];

export function AdminDashboardPage() {
  return (
    <section aria-labelledby="admin-dash-title">
      <h1 id="admin-dash-title" className="page-title">
        Admin dashboard
      </h1>
      <p className="lede">Monitoring widgets arrive in Phase 13. Use the tools below now.</p>
      <div className="stub-grid">
        {LINKS.map((item) => (
          <article key={item.to} className="stub-card">
            <h2>{item.title}</h2>
            <p>{item.copy}</p>
            <Link className="secondary-button link-button" to={item.to}>
              Open
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
