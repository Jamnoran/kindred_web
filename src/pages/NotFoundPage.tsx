import { Link } from "react-router-dom";
import { usePageTitle } from "../usePageTitle";

/** Catch-all for unknown routes — without it they render a blank page. */
export function NotFoundPage() {
  usePageTitle("Page not found");
  return (
    <div className="page">
      <div className="card empty-state">
        <span className="empty-state-emoji">🧭</span>
        <h2>Page not found</h2>
        <p className="muted">That link doesn't go anywhere (anymore).</p>
        <Link className="button" to="/">
          Back to Discover
        </Link>
      </div>
    </div>
  );
}
