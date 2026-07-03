import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { auth } from "../api/endpoints";
import { errorMessage } from "../api/http";

/**
 * Landing page for the verification link in the email:
 * /verify-email?token=... — posts the token once on load.
 */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("error");
      setError("Missing verification token.");
      return;
    }
    auth
      .verifyEmail(token)
      .then(() => setState("ok"))
      .catch((err) => {
        setState("error");
        setError(errorMessage(err));
      });
  }, [token]);

  async function resend() {
    await auth.resendVerification(email);
    setResent(true);
  }

  return (
    <div className="auth-page">
      <h1>Kindred</h1>
      <div className="card">
        {state === "working" && <p>Verifying your email…</p>}
        {state === "ok" && (
          <>
            <h2>Email verified 🎉</h2>
            <p>
              You can now <Link to="/login">log in</Link>.
            </p>
          </>
        )}
        {state === "error" && (
          <>
            <h2>Verification failed</h2>
            <p className="error">{error}</p>
            <p>The link may have expired or already been used. Request a new one:</p>
            {resent ? (
              <p className="notice">If that address has an account, a new email is on its way.</p>
            ) : (
              <form
                className="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  resend();
                }}
              >
                <label>
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>
                <button type="submit">Resend verification email</button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
