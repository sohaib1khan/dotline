export function AdminDashboardPage() {
  return (
    <section aria-labelledby="admin-dash-title">
      <h1 id="admin-dash-title" className="page-title">
        Admin dashboard
      </h1>
      <p className="page-copy">Monitoring widgets arrive in Phase 13. Email settings are ready now.</p>
      <div className="stub-grid">
        <article className="stub-card">
          <h2>Users</h2>
          <p>Manage learners later.</p>
        </article>
        <article className="stub-card">
          <h2>Content</h2>
          <p>CMS arrives in Phase 12.</p>
        </article>
        <article className="stub-card">
          <h2>Email</h2>
          <p>Use Settings in the nav to configure Resend.</p>
        </article>
      </div>
    </section>
  );
}
