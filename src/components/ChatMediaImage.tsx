import { useEffect, useRef, useState } from "react";
import { chat } from "../api/endpoints";
import { ApiError } from "../api/http";
import type { ChatMediaSummary, PhotoUrls } from "../api/types";
import { BlurhashImage } from "./BlurhashImage";

interface Props {
  conversationId: number;
  media: ChatMediaSummary;
}

const EXPIRY_MARGIN_MS = 10_000;

/**
 * An image inside a chat bubble. The bytes live behind signed URLs that expire
 * after ~5 minutes, so we only fetch them while the bubble is on screen and
 * refetch when they lapse. NSFW images never load bytes until the viewer taps
 * "reveal" — only the blurhash is shown, and the choice is per image.
 */
export function ChatMediaImage({ conversationId, media }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [urls, setUrls] = useState<PhotoUrls | null>(null);
  const [gone, setGone] = useState(false);
  const [visible, setVisible] = useState(false);
  const expiresAt = useRef(0);
  const fetching = useRef(false);
  const frameRef = useRef<HTMLDivElement>(null);

  // The one gate for ever requesting bytes: approved, and if nsfw, revealed.
  const mayFetch = media.status === "approved" && (!media.nsfw || revealed) && !gone;

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "150px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mayFetch || !visible || fetching.current) return;
    if (urls && Date.now() < expiresAt.current - EXPIRY_MARGIN_MS) return;
    fetching.current = true;
    chat
      .mediaUrls(conversationId, media.id)
      .then((res) => {
        expiresAt.current = Date.parse(res.expiresAt);
        setUrls(res.urls);
      })
      .catch((err) => {
        // 409 = still processing (the "media" event will update us);
        // 404 = rejected or removed.
        if (err instanceof ApiError && err.status === 404) setGone(true);
      })
      .finally(() => {
        fetching.current = false;
      });
  }, [mayFetch, visible, urls, conversationId, media.id]);

  if (media.status === "rejected" || gone) {
    return <div className="bubble-media media-removed">Image removed</div>;
  }

  return (
    <div className="bubble-media" ref={frameRef}>
      <BlurhashImage
        blurhash={media.blurhash}
        src={mayFetch ? urls?.card : null}
        alt="Photo"
        className="chat-media-frame"
        onError={() => setUrls(null) /* expired signed URL — refetch on next pass */}
      />
      {media.status === "pending" && <span className="media-overlay">Processing…</span>}
      {media.status === "approved" && media.nsfw && !revealed && (
        <button
          type="button"
          className="media-reveal"
          onClick={() => setRevealed(true)}
        >
          Sensitive photo
          <small>Tap to reveal</small>
        </button>
      )}
    </div>
  );
}
