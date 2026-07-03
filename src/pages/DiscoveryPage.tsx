import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { discovery } from "../api/endpoints";
import { errorMessage } from "../api/http";
import type { DiscoveryCard, Factors, ReactionKind } from "../api/types";
import { BlurhashImage } from "../components/BlurhashImage";

export function DiscoveryPage() {
  const [deck, setDeck] = useState<DiscoveryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<{ name: string; conversationId: number | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadDeck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDeck(await discovery.deck(20));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  const card = deck[0];

  async function react(kind: ReactionKind) {
    if (!card || busy) return;
    setBusy(true);
    try {
      const result = await discovery.react(card.userId, kind);
      if (result.matched) {
        setMatch({ name: card.displayName, conversationId: result.conversationId });
      }
      const rest = deck.slice(1);
      setDeck(rest);
      if (rest.length === 0) await loadDeck();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading && deck.length === 0) return <div className="page-loading">Loading…</div>;

  return (
    <div className="page">
      {match && (
        <div className="modal-backdrop" onClick={() => setMatch(null)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h2>It's a match! 🎉</h2>
            <p>You and {match.name} liked each other.</p>
            {match.conversationId != null ? (
              <Link className="button" to={`/chats/${match.conversationId}`}>
                Say hi
              </Link>
            ) : (
              <Link className="button" to="/chats">
                Open chats
              </Link>
            )}
            <button className="link-button" onClick={() => setMatch(null)}>
              Keep browsing
            </button>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {!card && !loading && (
        <div className="card empty-state">
          <h2>No one new right now</h2>
          <p>Widen your preferences or check back later.</p>
          <button onClick={loadDeck}>Refresh</button>
        </div>
      )}

      {card && (
        <div className="card discovery-card">
          <BlurhashImage
            blurhash={card.photo?.blurhash}
            src={card.photo?.urls?.card}
            alt={card.displayName}
            className="discovery-photo"
          />
          <div className="discovery-body">
            <h2>
              {card.displayName}, {card.age}
              {card.distanceKm != null && <span className="muted"> · {card.distanceKm} km</span>}
            </h2>
            {card.bio && <p>{card.bio}</p>}
            {card.lookingFor.length > 0 && (
              <p className="muted">Looking for: {card.lookingFor.join(", ")}</p>
            )}
            {card.interests.length > 0 && (
              <div className="chip-row">
                {card.interests.map((slug) => (
                  <span
                    key={slug}
                    className={`chip ${card.whyThisPerson.sharedInterests.includes(slug) ? "chip-on" : ""}`}
                  >
                    {slug}
                  </span>
                ))}
              </div>
            )}
            <WhyThisPerson factors={card.whyThisPerson} />
          </div>
          <div className="react-row">
            <button className="react pass" disabled={busy} onClick={() => react("pass")}>
              ✕ Pass
            </button>
            <button className="react like" disabled={busy} onClick={() => react("like")}>
              ♥ Like
            </button>
            <button className="react superlike" disabled={busy} onClick={() => react("superlike")}>
              ★ Superlike
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Transparent score breakdown — a core product principle, always shown.
 */
function WhyThisPerson({ factors }: { factors: Factors }) {
  const rows = [
    {
      label: "Shared interests",
      score: factors.interestScore,
      weight: factors.weights.interests,
      detail:
        factors.sharedInterests.length > 0
          ? factors.sharedInterests.join(", ")
          : "none in common",
    },
    {
      label: "Proximity",
      score: factors.distanceScore,
      weight: factors.weights.distance,
      detail: factors.distanceKm != null ? `${factors.distanceKm} km away` : "distance hidden",
    },
    {
      label: "Recently active",
      score: factors.activityScore,
      weight: factors.weights.activity,
      detail:
        factors.daysSinceActive === 0
          ? "active today"
          : `active ${factors.daysSinceActive} day(s) ago`,
    },
    {
      label: "Mutual fit",
      score: factors.mutualFitScore,
      weight: factors.weights.mutualFit,
      detail: "you match each other's preferences",
    },
  ];

  return (
    <details className="why" open>
      <summary>Why this person? (score {factors.total.toFixed(2)})</summary>
      <ul>
        {rows.map((row) => (
          <li key={row.label}>
            <div className="why-row">
              <span>{row.label}</span>
              <span className="muted">
                {row.detail} · weight {row.weight}
              </span>
            </div>
            <div className="meter">
              <div
                className="meter-fill"
                style={{ width: `${Math.round(Math.max(0, Math.min(1, row.score)) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
