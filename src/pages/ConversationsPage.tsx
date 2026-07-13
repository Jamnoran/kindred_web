import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { chat } from "../api/endpoints";
import { errorMessage } from "../api/http";
import type { ChatEvent, Conversation, Message } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { BlurhashImage } from "../components/BlurhashImage";
import { onConnected, subscribeConversation } from "../realtime/stomp";
import { relativeTime } from "../time";
import { usePageTitle } from "../usePageTitle";

/**
 * Last-message preview. Media messages get a generic label — never a
 * thumbnail here, which also satisfies the NSFW rule for the list (§6B).
 */
function preview(lastMessage: Message, myId: number | undefined): string {
  const prefix = lastMessage.senderId === myId ? "You: " : "";
  if (lastMessage.media) {
    return `${prefix}📷 Photo${lastMessage.body ? ` · ${lastMessage.body}` : ""}`;
  }
  return `${prefix}${lastMessage.body ?? ""}`;
}

export function ConversationsPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  usePageTitle("Chats");

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

  const onEvent = useCallback(
    (event: ChatEvent) => {
      if (event.type === "presence") {
        // Keep the online dots live without a refetch.
        if (event.presenceUserId === null || event.online === null) return;
        const presenceUserId = event.presenceUserId;
        const online = event.online;
        setConversations(
          (current) =>
            current?.map((c) =>
              c.id === event.conversationId && c.otherUser.userId === presenceUserId
                ? { ...c, otherUser: { ...c.otherUser, online } }
                : c,
            ) ?? current,
        );
      } else if (event.type === "message" || event.type === "media") {
        // New activity: refetch for ordering, lastMessage and unread counts.
        refresh();
      }
    },
    [refresh],
  );

  // Live updates while the list is open. Only ids returned by
  // GET /conversations — the server kills the socket for foreign ids.
  const idsKey = conversations?.map((c) => c.id).join(",") ?? "";
  useEffect(() => {
    if (!idsKey) return;
    const unsubscribes = idsKey
      .split(",")
      .map((id) => subscribeConversation(Number(id), onEvent));
    return () => unsubscribes.forEach((off) => off());
  }, [idsKey, onEvent]);

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
              <div className="avatar-wrap">
                <BlurhashImage
                  blurhash={convo.otherUser.photo?.blurhash}
                  src={convo.otherUser.photo?.urls?.thumb}
                  alt={convo.otherUser.displayName}
                  className="avatar"
                />
                {convo.otherUser.online && <span className="online-dot" aria-label="Online" />}
              </div>
              <div className="conversation-text">
                <strong>{convo.otherUser.displayName}</strong>
                <span className="muted preview">
                  {convo.lastMessage
                    ? preview(convo.lastMessage, user?.id)
                    : "New match — say hi!"}
                </span>
              </div>
              <div className="conversation-meta">
                <span className="muted convo-time">
                  {relativeTime(convo.lastMessage?.createdAt ?? convo.matchedAt)}
                </span>
                {convo.unreadCount > 0 && (
                  <span className="unread-badge">{convo.unreadCount}</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
