import { useAuth } from "@/store/auth";

export function StatusboardPage() {
  const user = useAuth((s) => s.user);
  return (
    <section aria-labelledby="statusboard-title">
      <h1 id="statusboard-title" className="page-title">
        Statusboard
      </h1>
      <p className="page-copy">
        Welcome{user ? `, ${user.first_name}` : ""}. Your learning home will live here.
      </p>
      <div className="stub-grid">
        <article className="stub-card">
          <h2>Level & XP</h2>
          <p>Gamification arrives in Phase 6.</p>
        </article>
        <article className="stub-card">
          <h2>Streak</h2>
          <p>Daily goals arrive later.</p>
        </article>
        <article className="stub-card">
          <h2>Continue</h2>
          <p>Track continue buttons arrive with lessons.</p>
        </article>
        <article className="stub-card">
          <h2>Inbox</h2>
          <p>Unread alerts will show here.</p>
        </article>
      </div>
    </section>
  );
}
