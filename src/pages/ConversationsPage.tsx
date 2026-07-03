import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { chat } from "../api/endpoints";
import { errorMessage } from "../api/http";
import type { Conversation } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { BlurhashImage } from "../components/BlurhashImage";
import { onConnected } from "../realtime/stomp";

export function ConversationsPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    chat
      .conversations()
      .then(setConversations)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    refresh();
    // The relay has no replay: re-sync whenever the socket (re)connects or
    // the tab regains focus.
    const offConnected = onConnected(refresh);
    window.addEventListener("focus", refresh);
    return () => {
      offConnected();
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  if (!conversations && !error) return <div className="page-loading">Loading…</div>;

  return (
    <div className="page">
      <h2>Chats</h2>
      {error && <p className="error">{error}</p>}
      {conversations && conversations.length === 0 && (
        <div className="card empty-state">
          <p>No matches yet. When you match with someone, your conversation appears here.</p>
          <Link to="/">Browse discovery</Link>
        </div>
      )}
      <ul className="conversation-list">
        {conversations?.map((convo) => (
          <li key={convo.id}>
            <Link to={`/chats/${convo.id}`} className="conversation-item">
              <BlurhashImage
                blurhash={convo.otherUser.photo?.blurhash}
                src={convo.otherUser.photo?.urls?.thumb}
                alt={convo.otherUser.displayName}
                className="avatar"
              />
              <div className="conversation-text">
                <strong>{convo.otherUser.displayName}</strong>
                <span className="muted preview">
                  {convo.lastMessage
                    ? `${convo.lastMessage.senderId === user?.id ? "You: " : ""}${convo.lastMessage.body}`
                    : `Matched ${new Date(convo.matchedAt).toLocaleDateString()} — say hi!`}
                </span>
              </div>
              {convo.unreadCount > 0 && <span className="unread-badge">{convo.unreadCount}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
