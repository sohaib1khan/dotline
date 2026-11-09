import { Link } from "react-router-dom";
import { AuthShell } from "@/components/AuthForm";

export function TracksPage() {
  return (
    <AuthShell
      title="What do you want to learn?"
      subtitle="Track picker arrives fully in a later phase. Your email is verified."
    >
      <div className="banner" role="status">
        <strong>Braille</strong> and <strong>Cursive</strong> tracks will be selectable here.
      </div>
      <p className="auth-links">
        <Link className="primary-button link-button" to="/app">
          Continue to Statusboard
        </Link>
      </p>
    </AuthShell>
  );
}
