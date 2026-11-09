import { Link } from "react-router-dom";
import { AdminEmailPanel } from "@/components/AdminEmailPanel";

/** Dedicated email route — same Resend form as Settings → Resend email. */
export function AdminEmailSettingsPage() {
  return (
    <section aria-labelledby="admin-email-title">
      <h1 id="admin-email-title" className="page-title">
        Settings → Resend email
      </h1>
      <p className="page-copy">
        <Link className="linkish" to="/admin/settings">
          Back to all settings
        </Link>
      </p>
      <AdminEmailPanel />
    </section>
  );
}
