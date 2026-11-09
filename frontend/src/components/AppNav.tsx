import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/store/auth";

type NavItem = { to: string; label: string; track?: "braille" | "cursive"; badge?: boolean };

const LEARNER_ITEMS: NavItem[] = [
  { to: "/app", label: "Statusboard" },
  { to: "/app/braille", label: "Braille", track: "braille" },
  { to: "/app/cursive", label: "Cursive", track: "cursive" },
  { to: "/app/games", label: "Games" },
  { to: "/app/progress", label: "Progress" },
  { to: "/app/inbox", label: "Inbox", badge: true },
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
  { to: "/admin/debug/input", label: "Input debug" },
  { to: "/admin/debug/xp", label: "XP debug" },
];

export function AppNav({ mode }: { mode: "learner" | "admin" }) {
  const logout = useAuth((s) => s.logout);
  const [tracks, setTracks] = useState<string[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (mode !== "learner") return;
    void apiGet<{ tracks: string[] }>("/api/me/tracks")
      .then((data) => setTracks(data.tracks))
      .catch(() => setTracks([]));
  }, [mode]);

  useEffect(() => {
    if (mode !== "learner") return;
    let cancelled = false;

    async function refreshUnread() {
      try {
        const data = await apiGet<{ unread_count: number }>("/api/inbox/unread-count");
        if (!cancelled) setUnread(data.unread_count);
      } catch {
        if (!cancelled) setUnread(0);
      }
    }

    void refreshUnread();
    const timer = window.setInterval(() => void refreshUnread(), 15000);
    const onFocus = () => void refreshUnread();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [mode]);

  const items =
    mode === "admin"
      ? ADMIN_ITEMS
      : LEARNER_ITEMS.filter((item) => !item.track || tracks.includes(item.track));

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
          <span>{item.label}</span>
          {item.badge && unread > 0 ? (
            <span className="nav-badge" aria-label={`${unread} unread messages`}>
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
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
