import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/store/auth";

export function RequireAuth({ role }: { role?: "admin" | "learner" }) {
  const user = useAuth((s) => s.user);
  const loading = useAuth((s) => s.loading);
  const location = useLocation();

  if (loading) {
    return (
      <div className="app-shell">
        <p className="status">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!user.email_verified_at) {
    return <Navigate to="/check-email" replace />;
  }

  if (role === "admin" && user.role !== "admin") {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}
