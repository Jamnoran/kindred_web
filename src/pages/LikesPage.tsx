import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { discovery } from "../api/endpoints";
import { errorMessage } from "../api/http";
import type { ReceivedLike } from "../api/types";
import { BlurhashImage } from "../components/BlurhashImage";

export function LikesPage() {
  const [likes, setLikes] = useState<ReceivedLike[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    discovery
      .likesReceived()
      .then(setLikes)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function likeBack(like: ReceivedLike) {
    setError(null);
    try {
      const result = await discovery.react(like.userId, "like");
      if (result.matched && result.conversationId != null) {
        navigate(`/chats/${result.conversationId}`);
        return;
      }
      setLikes((current) => current?.filter((l) => l.userId !== like.userId) ?? null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!likes && !error) return <div className="page-loading">Loading…</div>;

  return (
    <div className="page">
      <h2>Who liked you</h2>
      {error && <p className="error">{error}</p>}
      {likes && likes.length === 0 && (
        <div className="card empty-state">
          <p>No likes yet — keep your profile fresh and check back.</p>
          <Link to="/">Browse discovery</Link>
        </div>
      )}
      <div className="likes-grid">
        {likes?.map((like) => (
          <div key={like.userId} className="card like-card">
            <BlurhashImage
              blurhash={like.photo?.blurhash}
              src={like.photo?.urls?.card}
              alt={like.displayName}
            />
            <div className="like-body">
              <strong>{like.displayName}</strong>
              <span className="muted">
                {like.kind === "superlike" ? "★ superliked you" : "♥ liked you"} ·{" "}
                {new Date(like.likedAt).toLocaleDateString()}
              </span>
              <button onClick={() => likeBack(like)}>Like back</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
