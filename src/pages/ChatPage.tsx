import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { chat, uploadPhotoBytes } from "../api/endpoints";
import { ApiError, errorMessage } from "../api/http";
import type { ChatEvent, Conversation, Message } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { BlurhashImage } from "../components/BlurhashImage";
import { ChatMediaImage } from "../components/ChatMediaImage";
import { onConnected, sendTyping, subscribeConversation } from "../realtime/stomp";

const PAGE_SIZE = 50;
const TYPING_THROTTLE_MS = 3000;
const TYPING_EXPIRE_MS = 5000;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Merge two batches, dedupe by id (REST + socket echo overlap), ascending. */
function mergeMessages(a: Message[], b: Message[]): Message[] {
  const byId = new Map<number, Message>();
  for (const m of [...a, ...b]) byId.set(m.id, m);
  return [...byId.values()].sort((x, y) => x.id - y.id);
}

export function ChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const conversationId = Number(id);
  const { user } = useAuth();
  const myId = user?.id;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [premiumRequired, setPremiumRequired] = useState(false);

  const typingExpireTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastTypingSentAt = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleError = useCallback((err: unknown) => {
    // 404 = not a member / deleted — indistinguishable by design.
    if (err instanceof ApiError && err.status === 404) setGone(true);
    else if (err instanceof ApiError && err.status === 402) {
      // Image messaging needs premium and our cached flag was stale —
      // the server is authoritative, so lock the attach UI immediately.
      setPremiumRequired(true);
      setAttachment(null);
      setConversation((c) => (c ? { ...c, imageMessagingEnabled: false } : c));
    } else setError(errorMessage(err));
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
        case "media":
          // An image finished processing (approved/rejected) — patch the
          // message that carries it. nsfw may be true here: ChatMediaImage
          // keeps the blurhash until the viewer taps.
          if (event.media) {
            const processed = event.media;
            setMessages((current) =>
              current.map((m) =>
                m.media?.id === processed.id ? { ...m, media: processed } : m,
              ),
            );
          }
          break;
        case "presence":
          if (event.online !== null && event.presenceUserId !== null) {
            const presenceUserId = event.presenceUserId;
            const online = event.online;
            setConversation((current) =>
              current && current.otherUser.userId === presenceUserId
                ? { ...current, otherUser: { ...current.otherUser, online } }
                : current,
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

  // Local object-URL preview for the picked attachment.
  useEffect(() => {
    if (!attachment) {
      setAttachmentPreview(null);
      return;
    }
    const url = URL.createObjectURL(attachment);
    setAttachmentPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment]);

  // Scroll only the message pane — scrollIntoView would also scroll the
  // page itself and hide the conversation header on mobile.
  useEffect(() => {
    const pane = scrollRef.current;
    if (pane) pane.scrollTop = pane.scrollHeight;
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

  function onPickImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      setError("Only JPEG, PNG or WebP images can be sent.");
      return;
    }
    setError(null);
    setAttachment(file);
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if ((!body && !attachment) || sending) return;
    setSending(true);
    setError(null);
    try {
      // Image first: presign scoped to this conversation, PUT the raw bytes
      // to storage, then reference the (single-use) key on the message.
      let mediaStorageKey: string | undefined;
      if (attachment) {
        const presigned = await chat.presignMedia(conversationId, attachment.type);
        await uploadPhotoBytes(presigned.uploadUrl, attachment);
        mediaStorageKey = presigned.storageKey;
      }
      // Sends go through REST; the socket echo is deduped by id.
      const sent = await chat.send(conversationId, {
        ...(body ? { body } : {}),
        ...(mediaStorageKey ? { mediaStorageKey } : {}),
      });
      setMessages((current) => mergeMessages(current, [sent]));
      setDraft("");
      setAttachment(null);
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
        <Link to="/chats" className="back" aria-label="Back to chats">
          ←
        </Link>
        <div className="avatar-wrap">
          <BlurhashImage
            blurhash={other.photo?.blurhash}
            src={other.photo?.urls?.thumb}
            alt={other.displayName}
            className="avatar avatar-sm"
          />
          {other.online && <span className="online-dot" aria-label="Online" />}
        </div>
        <div className="chat-header-text">
          <strong>{other.displayName}</strong>
          {otherTyping ? (
            <span className="muted typing">typing…</span>
          ) : other.online ? (
            <span className="presence-label">Online</span>
          ) : null}
        </div>
      </header>

      <div className="chat-scroll" ref={scrollRef}>
        {hasMore && (
          <button className="link-button load-older" onClick={loadOlder}>
            Load older messages
          </button>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`bubble-row ${m.senderId === myId ? "mine" : "theirs"}`}>
            <div className="bubble">
              {m.media && <ChatMediaImage conversationId={conversationId} media={m.media} />}
              {m.body && <p>{m.body}</p>}
              <span className="bubble-meta">
                {dayFormat.format(new Date(m.createdAt))}
                {m.id === lastOwnRead?.id && " · Read"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      {premiumRequired && (
        <p className="error">
          Sending photos needs Kindred Premium — one purchase unlocks it for
          both of you. <Link to="/premium">Upgrade</Link>
        </p>
      )}

      {attachmentPreview && (
        <div className="compose-attachment">
          <img src={attachmentPreview} alt="Selected image" />
          <span className="muted">{attachment?.name}</span>
          <button
            type="button"
            className="link-button"
            onClick={() => setAttachment(null)}
            disabled={sending}
          >
            Remove
          </button>
        </div>
      )}

      <form className="chat-compose" onSubmit={onSend}>
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          onChange={onPickImage}
          hidden
        />
        {conversation.imageMessagingEnabled ? (
          <button
            type="button"
            className="secondary attach-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            aria-label="Attach an image"
          >
            📷
          </button>
        ) : (
          // Free/free chat: attaching would 402 — route to the upgrade
          // page instead. One participant's purchase unlocks both.
          <button
            type="button"
            className="secondary attach-button"
            onClick={() => navigate("/premium")}
            aria-label="Upgrade to send photos"
            title="Sending photos needs Premium"
          >
            🔒
          </button>
        )}
        <input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder={`Message ${other.displayName}…`}
          maxLength={2000}
        />
        <button type="submit" disabled={sending || (!draft.trim() && !attachment)}>
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
