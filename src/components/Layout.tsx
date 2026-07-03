import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { disconnect } from "../realtime/stomp";
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

  if (user === undefined) return <div className="page-loading">Loading…</div>;
  if (user === null) return <Navigate to="/login" replace />;

  async function onLogout() {
    disconnect();
    await logout();
    navigate("/login");
  }

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
            <Icon name={tab.icon} />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
