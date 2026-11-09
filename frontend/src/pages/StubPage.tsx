export function StubPage({ title, copy }: { title: string; copy: string }) {
  return (
    <section aria-labelledby="stub-title">
      <h1 id="stub-title" className="page-title">
        {title}
      </h1>
      <p className="page-copy">{copy}</p>
      <div className="banner" role="status">
        <strong>Coming in a later phase.</strong>
        <p>This screen is wired into the app shell so layout and navigation can be tested now.</p>
      </div>
    </section>
  );
}
