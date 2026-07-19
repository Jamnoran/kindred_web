import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { chat, profile } from "../api/endpoints";
import { errorMessage } from "../api/http";
import type { MatchProfileResponse } from "../api/types";
import { BlurhashImage } from "../components/BlurhashImage";
import { GENDER_LABELS, RELATIONSHIP_STYLE_LABELS } from "../inclusivity";
import { usePageTitle } from "../usePageTitle";

export function MatchProfilePage() {
  const { id } = useParams();
  const conversationId = Number(id);

  const [matchProfile, setMatchProfile] = useState<MatchProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  usePageTitle(matchProfile?.displayName);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const conversations = await chat.conversations();
        const convo = conversations.find((c) => c.id === conversationId);
        if (!convo) {
          if (!cancelled) setError("Conversation not found.");
          return;
        }
        const data = await profile.getMatch(convo.otherUser.userId);
        if (!cancelled) setMatchProfile(data);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  if (loading) return <div className="page-loading">Loading…</div>;

  if (error || !matchProfile) {
    return (
      <div className="page">
        <div className="card empty-state">
          <h2>Profile unavailable</h2>
          <p>{error ?? "This profile could not be loaded."}</p>
          <Link to={`/chats/${conversationId}`}>Back to chat</Link>
        </div>
      </div>
    );
  }

  const p = matchProfile;

  return (
    <div className="page">
      <div className="card discovery-card">
        <div className="discovery-photo-wrap">
          <BlurhashImage
            blurhash={p.photo?.blurhash}
            src={p.photo?.urls?.card}
            alt={p.displayName}
            className="discovery-photo"
          />
          <div className="discovery-overlay">
            <h2>
              {p.displayName}, {p.age}
              {p.gender && <span className="muted"> · {GENDER_LABELS[p.gender]}</span>}
            </h2>
          </div>
        </div>

        <div className="discovery-body">
          {p.bio && <p>{p.bio}</p>}
          {p.lookingFor.length > 0 && (
            <p className="muted">Looking for: {p.lookingFor.join(", ")}</p>
          )}
          {p.relationshipStyles.length > 0 && (
            <p className="muted">
              Relationship style:{" "}
              {p.relationshipStyles.map((s) => RELATIONSHIP_STYLE_LABELS[s]).join(", ")}
            </p>
          )}
          {p.interests.length > 0 && (
            <div className="chip-row">
              {p.interests.map((slug) => (
                <span key={slug} className="chip">
                  {slug}
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "0 1.2rem 1.2rem" }}>
          <Link className="button" to={`/chats/${conversationId}`} style={{ display: "block", textAlign: "center" }}>
            Back to chat
          </Link>
        </div>
      </div>
    </div>
  );
}
