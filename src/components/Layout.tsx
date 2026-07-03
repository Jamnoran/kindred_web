import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { disconnect } from "../realtime/stomp";

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
      <nav className="nav">
        <span className="nav-brand">Kindred</span>
        <div className="nav-links">
          <NavLink to="/">Discover</NavLink>
          <NavLink to="/likes">Likes</NavLink>
          <NavLink to="/chats">Chats</NavLink>
          <NavLink to="/photos">Photos</NavLink>
          <NavLink to="/profile">Profile</NavLink>
          <NavLink to="/preferences">Preferences</NavLink>
        </div>
        <button className="link-button" onClick={onLogout}>
          Log out
        </button>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
