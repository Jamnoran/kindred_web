import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { premium } from "../api/endpoints";
import { ApiError, errorMessage } from "../api/http";
import type { PremiumStatusResponse } from "../api/types";

const POLL_INTERVAL_MS = 2000;
/** After ~30 s of polling, admit it's taking longer than usual. */
const POLL_SLOW_AFTER = 15;

interface Props {
  /** Stripe redirect landings; undefined = the plain upgrade page. */
  variant?: "success" | "cancelled";
}

export function PremiumPage({ variant }: Props) {
  const [status, setStatus] = useState<PremiumStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    premium
      .status()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Landing on the success URL is NOT proof of payment: the upgrade is
  // granted asynchronously by the Stripe webhook (usually within seconds).
  // Poll until the backend says premium.
  useEffect(() => {
    if (variant !== "success" || !status || status.premium) return;
    let polls = 0;
    const timer = setInterval(async () => {
      polls += 1;
      if (polls > POLL_SLOW_AFTER) setSlow(true);
      try {
        const s = await premium.status();
        // Only set state on the flip — a new object every tick would
        // restart this effect (and the interval) for no reason.
        if (s.premium) setStatus(s);
      } catch {
        // Transient failure; keep polling.
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [variant, status]);

  async function startCheckout() {
    setRedirecting(true);
    setError(null);
    try {
      const { checkoutUrl } = await premium.checkout();
      // Stripe-hosted page — full browser redirect, no Stripe.js needed.
      window.location.assign(checkoutUrl);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Already premium (e.g. bought in another tab); refresh instead.
        try {
          setStatus(await premium.status());
        } catch {
          // Keep the page usable; the stale status just shows the button.
        }
      } else {
        setError(errorMessage(err));
      }
      setRedirecting(false);
    }
  }

  if (!status && !error) return <div className="page-loading">Loading…</div>;

  if (status?.premium) {
    return (
      <div className="page">
        <div className="card empty-state">
          <span className="empty-state-emoji">✨</span>
          <h2>{variant === "success" ? "Payment confirmed" : "You have Premium"}</h2>
          <p>
            Photo sharing is unlocked in all your chats — for you and whoever
            you're talking to.
            {status.premiumSince &&
              ` Premium since ${new Date(status.premiumSince).toLocaleDateString()}.`}
          </p>
          <Link to="/chats">Go to chats</Link>
        </div>
      </div>
    );
  }

  if (variant === "success") {
    return (
      <div className="page">
        <div className="card empty-state">
          <span className="empty-state-emoji">⏳</span>
          <h2>Confirming your payment…</h2>
          <p className="muted">
            {slow
              ? "This is taking longer than usual. Your payment is processed by Stripe and confirmed automatically — it's safe to leave this page and come back."
              : "Almost there — this usually takes a couple of seconds."}
          </p>
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {variant === "cancelled" && (
        <p className="notice">Checkout was cancelled — you haven't been charged.</p>
      )}
      <div className="card empty-state">
        <span className="empty-state-emoji">📷</span>
        <h2>Kindred Premium</h2>
        <p>One-time purchase. No subscription, never expires.</p>
        <ul className="premium-benefits">
          <li>Send photos in your chats.</li>
          <li>One upgrade unlocks photos for both people in the conversation.</li>
          <li>Text chat and viewing photos you receive stay free for everyone.</li>
        </ul>
        {error && <p className="error">{error}</p>}
        <button onClick={startCheckout} disabled={redirecting}>
          {redirecting ? "Opening checkout…" : "Upgrade"}
        </button>
        <p className="muted">You'll be taken to Stripe to pay securely.</p>
      </div>
    </div>
  );
}
