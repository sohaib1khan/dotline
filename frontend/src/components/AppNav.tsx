import { NavLink } from "react-router-dom";
import { useAuth } from "@/store/auth";

type NavItem = { to: string; label: string };

const LEARNER_ITEMS: NavItem[] = [
  { to: "/app", label: "Statusboard" },
  { to: "/app/braille", label: "Braille" },
  { to: "/app/cursive", label: "Cursive" },
  { to: "/app/games", label: "Games" },
  { to: "/app/progress", label: "Progress" },
  { to: "/app/inbox", label: "Inbox" },
  { to: "/app/report", label: "Report" },
  { to: "/app/settings", label: "Settings" },
];

const ADMIN_ITEMS: NavItem[] = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/monitoring", label: "Monitoring" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/content", label: "Content" },
  { to: "/admin/bugs", label: "Bugs" },
  { to: "/admin/announcements", label: "Announce" },
  { to: "/admin/settings/email", label: "Settings" },
];

export function AppNav({ mode }: { mode: "learner" | "admin" }) {
  const logout = useAuth((s) => s.logout);
  const items = mode === "admin" ? ADMIN_ITEMS : LEARNER_ITEMS;

  return (
    <nav className="nav-rail" aria-label={mode === "admin" ? "Admin navigation" : "Learner navigation"}>
      <p className="nav-brand">Dotline</p>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/app" || item.to === "/admin"}
          className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
        >
          {item.label}
        </NavLink>
      ))}
      {mode === "admin" ? (
        <NavLink to="/app" className="nav-link">
          Learner view
        </NavLink>
      ) : null}
      <button
        type="button"
        className="nav-link"
        onClick={() => {
          void logout().then(() => {
            window.location.assign("/login");
          });
        }}
      >
        Log out
      </button>
    </nav>
  );
}
