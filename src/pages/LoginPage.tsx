import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { Location } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError, errorMessage } from "../api/http";
import { auth } from "../api/endpoints";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  // Set by ProtectedLayout when an unauthenticated visit gets bounced here
  // (e.g. a /conversations/{id} deep link from a notification email).
  const from = (useLocation().state as { from?: Location } | null)?.from;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setUnverified(false);
    setBusy(true);
    try {
      await login(email, password);
      navigate(from ? from.pathname + from.search : "/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        // correct password but email not verified
        setUnverified(true);
      } else if (err instanceof ApiError && err.status === 401) {
        setError("Wrong email or password.");
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    await auth.resendVerification(email);
    setResent(true);
  }

  return (
    <div className="auth-page">
      <h1>Kindred</h1>
      <p className="tagline">Find your kindred spirit</p>
      <form className="card form" onSubmit={onSubmit}>
        <h2>Log in</h2>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        {unverified && (
          <p className="notice">
            Your email isn't verified yet — check your inbox.{" "}
            {resent ? (
              "Verification email sent."
            ) : (
              <button type="button" className="link-button" onClick={resend}>
                Resend it
              </button>
            )}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </button>
        <p>
          No account? <Link to="/signup">Sign up</Link>
        </p>
      </form>
    </div>
  );
}
