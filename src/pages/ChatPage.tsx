import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { chat } from "../api/endpoints";
import { ApiError, errorMessage } from "../api/http";
import type { ChatEvent, Conversation, Message } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { onConnected, sendTyping, subscribeConversation } from "../realtime/stomp";

const PAGE_SIZE = 50;
const TYPING_THROTTLE_MS = 3000;
const TYPING_EXPIRE_MS = 5000;

/** Merge two batches, dedupe by id (REST + socket echo overlap), ascending. */
function mergeMessages(a: Message[], b: Message[]): Message[] {
  const byId = new Map<number, Message>();
  for (const m of [...a, ...b]) byId.set(m.id, m);
  return [...byId.values()].sort((x, y) => x.id - y.id);
}

export function ChatPage() {
  const { id } = useParams();
  const conversationId = Number(id);
  const { user } = useAuth();
  const myId = user?.id;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [sending, setSending] = useState(false);

  const typingExpireTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastTypingSentAt = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleError = useCallback((err: unknown) => {
    // 404 = not a member / deleted — indistinguishable by design.
    if (err instanceof ApiError && err.status === 404) setGone(true);
    else setError(errorMessage(err));
  }, []);

  // Only subscribe to ids confirmed by GET /conversations — the server
  // closes the socket for foreign ids.
  useEffect(() => {
    let cancelled = false;
    chat
      .conversations()
      .then((list) => {
        if (cancelled) return;
        const convo = list.find((c) => c.id === conversationId);
        if (!convo) setGone(true);
        else setConversation(convo);
      })
      .catch(handleError);
    return () => {
      cancelled = true;
    };
  }, [conversationId, handleError]);

  const syncLatest = useCallback(() => {
    chat
      .messages(conversationId, PAGE_SIZE)
      .then((newestFirst) => {
        setMessages((current) => {
          if (current.length === 0 && newestFirst.length === PAGE_SIZE) setHasMore(true);
          return mergeMessages(current, newestFirst);
        });
      })
      .catch(handleError);
    chat.markRead(conversationId).catch(() => {});
  }, [conversationId, handleError]);

  // Initial load + re-sync on every socket (re)connect: the relay is
  // fire-and-forget with no replay, so REST is the source of truth.
  useEffect(() => {
    if (!conversation) return;
    syncLatest();
    return onConnected(syncLatest);
  }, [conversation, syncLatest]);

  // Realtime events. Own sends/reads echo back — filter where needed.
  useEffect(() => {
    if (!conversation || myId === undefined) return;
    return subscribeConversation(conversationId, (event: ChatEvent) => {
      switch (event.type) {
        case "message":
          if (event.message) {
            const incoming = event.message;
            setMessages((current) => mergeMessages(current, [incoming]));
            if (incoming.senderId !== myId) {
              chat.markRead(conversationId).catch(() => {});
            }
          }
          break;
        case "read":
          if (event.readerId !== null && event.readerId !== myId) {
            const readAt = new Date().toISOString();
            setMessages((current) =>
              current.map((m) => (m.senderId === myId && !m.readAt ? { ...m, readAt } : m)),
            );
          }
          break;
        case "typing":
          if (event.typingUserId !== null && event.typingUserId !== myId) {
            setOtherTyping(true);
            clearTimeout(typingExpireTimer.current);
            // No "stopped typing" event exists; expire client-side.
            typingExpireTimer.current = setTimeout(
              () => setOtherTyping(false),
              TYPING_EXPIRE_MS,
            );
          }
          break;
        default:
          // Unknown event types (future features) must be ignored.
          break;
      }
    });
  }, [conversation, conversationId, myId]);

  useEffect(() => () => clearTimeout(typingExpireTimer.current), []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, otherTyping]);

  async function loadOlder() {
    if (messages.length === 0) return;
    try {
      const older = await chat.messages(conversationId, PAGE_SIZE, messages[0].id);
      setHasMore(older.length === PAGE_SIZE);
      setMessages((current) => mergeMessages(older, current));
    } catch (err) {
      handleError(err);
    }
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      // Sends go through REST; the socket echo is deduped by id.
      const sent = await chat.send(conversationId, body);
      setMessages((current) => mergeMessages(current, [sent]));
      setDraft("");
    } catch (err) {
      handleError(err);
    } finally {
      setSending(false);
    }
  }

  function onDraftChange(value: string) {
    setDraft(value);
    const now = Date.now();
    if (value && now - lastTypingSentAt.current > TYPING_THROTTLE_MS) {
      lastTypingSentAt.current = now;
      sendTyping(conversationId);
    }
  }

  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }),
    [],
  );

  if (gone) {
    return (
      <div className="page">
        <div className="card empty-state">
          <h2>Conversation unavailable</h2>
          <p>This conversation no longer exists.</p>
          <Link to="/chats">Back to chats</Link>
        </div>
      </div>
    );
  }

  if (!conversation) return <div className="page-loading">Loading…</div>;

  const other = conversation.otherUser;
  const lastOwnRead = [...messages].reverse().find((m) => m.senderId === myId && m.readAt);

  return (
    <div className="chat-page">
      <header className="chat-header">
        <Link to="/chats">←</Link>
        <strong>{other.displayName}</strong>
        {otherTyping && <span className="muted typing">typing…</span>}
      </header>

      <div className="chat-scroll">
        {hasMore && (
          <button className="link-button load-older" onClick={loadOlder}>
            Load older messages
          </button>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`bubble-row ${m.senderId === myId ? "mine" : "theirs"}`}>
            <div className="bubble">
              <p>{m.body}</p>
              <span className="bubble-meta">
                {dayFormat.format(new Date(m.createdAt))}
                {m.id === lastOwnRead?.id && " · Read"}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="error">{error}</p>}

      <form className="chat-compose" onSubmit={onSend}>
        <input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder={`Message ${other.displayName}…`}
          maxLength={2000}
        />
        <button type="submit" disabled={sending || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
