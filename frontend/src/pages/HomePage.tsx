import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <main className="main-panel" aria-label="Dotline home">
      <h1 className="brand">Dotline</h1>
      <p className="status">Learn braille and cursive — made for low vision.</p>
      <div className="cta-row">
        <Link className="primary-button link-button" to="/signup">
          Sign up
        </Link>
        <Link className="secondary-button link-button" to="/login">
          Log in
        </Link>
      </div>
    </main>
  );
}
