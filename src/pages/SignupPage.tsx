import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { auth } from "../api/endpoints";
import { errorMessage } from "../api/http";
import { usePageTitle } from "../usePageTitle";

/** Latest birth date (YYYY-MM-DD) that is 18+ today. */
function minAdultDob(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

export function SignupPage() {
  usePageTitle("Sign up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (dob > minAdultDob()) {
      setError("You must be at least 18 to use Kindred.");
      return;
    }
    setBusy(true);
    try {
      await auth.signup(email, password, dob);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="auth-page">
        <h1>Kindred</h1>
        <div className="card">
          <h2>Check your inbox</h2>
          <p>
            We sent a verification link to <strong>{email}</strong>. Click it, then{" "}
            <Link to="/login">log in</Link>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <h1>Kindred</h1>
      <p className="tagline">Find your kindred spirit</p>
      <form className="card form" onSubmit={onSubmit}>
        <h2>Sign up</h2>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password (8–72 characters)
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            maxLength={72}
            required
          />
        </label>
        <label>
          Date of birth (you must be 18+)
          <input
            type="date"
            autoComplete="bday"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            max={minAdultDob()}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? "Signing up…" : "Sign up"}
        </button>
        <p>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
