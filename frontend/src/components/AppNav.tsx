import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { BrandMark } from "@/components/BrandMark";
import { apiGet } from "@/lib/api";
import { applyRoomTheme, roomFromPath, type RoomTrack } from "@/store/room";
import { useAuth } from "@/store/auth";

type NavItem = { to: string; label: string; end?: boolean; badge?: boolean };

const ADMIN_ITEMS: NavItem[] = [
  { to: "/admin", label: "Console", end: true },
  { to: "/admin/settings", label: "Settings" },
  { to: "/admin/content", label: "Course content" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/monitoring/logins", label: "Login log" },
  { to: "/admin/monitoring", label: "Monitoring" },
  { to: "/admin/bugs", label: "Bugs" },
  { to: "/admin/announcements", label: "Announce" },
  { to: "/admin/debug/input", label: "Input debug" },
  { to: "/admin/debug/xp", label: "XP debug" },
];

function learnerItems(room: RoomTrack | null, isAdmin: boolean): NavItem[] {
  const preview = isAdmin
    ? [{ to: "/admin", label: "Admin console", end: true as const }]
    : [];
  if (!room) {
    return [
      ...preview,
      { to: "/app", label: "Rooms", end: true },
      { to: "/app/inbox", label: "Inbox", badge: true },
      { to: "/app/settings", label: "Settings" },
    ];
  }
  const roomHome = `/app/rooms/${room}`;
  const trackPath = `/app/${room}`;
  return [
    ...preview,
    { to: roomHome, label: "Statusboard", end: true },
    { to: trackPath, label: room === "braille" ? "Braille lessons" : "Cursive lessons" },
    { to: "/app/games", label: "Games" },
    { to: "/app/progress", label: "Progress" },
    { to: "/app/inbox", label: "Inbox", badge: true },
    { to: "/app/report", label: "Report" },
    { to: "/app/settings", label: "Settings" },
    { to: "/app", label: "Change room" },
  ];
}

export function AppNav({ mode }: { mode: "learner" | "admin" }) {
  const logout = useAuth((s) => s.logout);
  const user = useAuth((s) => s.user);
  const location = useLocation();
  const room = mode === "learner" ? roomFromPath(location.pathname) : null;
  const isAdmin = user?.role === "admin";
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (mode === "learner") applyRoomTheme(room);
    else applyRoomTheme(null);
    return () => {
      if (mode === "learner") applyRoomTheme(null);
    };
  }, [mode, room]);

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

  const items = mode === "admin" ? ADMIN_ITEMS : learnerItems(room, Boolean(isAdmin));

  return (
    <nav
      className={`nav-rail${mode === "admin" ? " nav-rail-admin" : ""}`}
      aria-label={mode === "admin" ? "Admin navigation" : "Learner navigation"}
    >
      <p className="nav-brand">
        <BrandMark
          title={mode === "admin" ? "Dotline Admin" : "Dotline"}
          to={mode === "admin" ? "/admin" : "/app"}
        />
      </p>
      {mode === "admin" ? (
        <p className="nav-admin-tag">
          <strong>Control panel</strong>
        </p>
      ) : null}
      {mode === "learner" && isAdmin ? (
        <p className="nav-preview-banner" role="status">
          <strong>Learner preview</strong>
        </p>
      ) : null}
      {items.map((item) => (
        <NavLink
          key={`${item.to}-${item.label}`}
          to={item.to}
          end={item.end}
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
        <NavLink to="/app" className="nav-link nav-link-muted">
          Preview learner
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
