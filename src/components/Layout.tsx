import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { chat } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { disconnect, onConnected } from "../realtime/stomp";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: "/", label: "Discover", icon: "compass", end: true },
  { to: "/likes", label: "Likes", icon: "heart" },
  { to: "/chats", label: "Chats", icon: "chat" },
  { to: "/photos", label: "Photos", icon: "camera" },
  { to: "/profile", label: "Profile", icon: "user" },
  { to: "/preferences", label: "Prefs", icon: "sliders" },
];

export function ProtectedLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  // Total unread across conversations, shown on the Chats tab. Refreshed on
  // navigation (reading a chat clears its count), tab focus, and socket
  // (re)connect — the relay has no replay, so REST is the source of truth.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const refresh = () => {
      chat
        .conversations()
        .then((list) => {
          if (!cancelled) setUnread(list.reduce((sum, c) => sum + c.unreadCount, 0));
        })
        .catch(() => {});
    };
    refresh();
    const offConnected = onConnected(refresh);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      offConnected();
      window.removeEventListener("focus", refresh);
    };
  }, [user, location.pathname]);

  if (user === undefined) return <div className="page-loading">Loading…</div>;
  // Remember where the user was headed (e.g. an email deep link) so the
  // login page can send them back after they authenticate.
  if (user === null) return <Navigate to="/login" replace state={{ from: location }} />;

  async function onLogout() {
    disconnect();
    await logout();
    navigate("/login");
  }

  const badge = (tab: (typeof TABS)[number]) =>
    tab.to === "/chats" && unread > 0 ? (
      <span className="nav-unread" aria-label={`${unread} unread`}>
        {unread > 99 ? "99+" : unread}
      </span>
    ) : null;

  return (
    <div className="app-shell">
      <header className="top-bar">
        <span className="nav-brand">
          <Icon name="heart" size={18} />
          Kindred
        </span>
        <nav className="top-links">
          {TABS.map((tab) => (
            <NavLink key={tab.to} to={tab.to} end={tab.end}>
              {tab.label}
              {badge(tab)}
            </NavLink>
          ))}
        </nav>
        <button className="link-button" onClick={onLogout}>
          Log out
        </button>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <nav className="tab-bar">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end}>
            <span className="tab-icon">
              <Icon name={tab.icon} />
              {badge(tab)}
            </span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
