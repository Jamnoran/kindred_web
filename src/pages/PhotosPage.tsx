import { useCallback, useEffect, useRef, useState } from "react";
import { photos, uploadPhotoBytes } from "../api/endpoints";
import { errorMessage } from "../api/http";
import type { PhotoResponse } from "../api/types";
import { BlurhashImage } from "../components/BlurhashImage";
import { usePageTitle } from "../usePageTitle";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTOS = 6;
const POLL_MS = 3000;

export function PhotosPage() {
  usePageTitle("Photos");
  const [list, setList] = useState<PhotoResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const refresh = useCallback(async () => {
    const next = await photos.list();
    setList(next);
    // Moderation is async: keep polling while anything is still pending.
    clearTimeout(pollTimer.current);
    if (next.some((p) => p.status === "pending")) {
      pollTimer.current = setTimeout(() => refresh().catch(() => {}), POLL_MS);
    }
  }, []);

  useEffect(() => {
    refresh().catch((err) => setError(errorMessage(err)));
    return () => clearTimeout(pollTimer.current);
  }, [refresh]);

  async function onFileChosen(file: File) {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError("Only JPEG, PNG or WebP images are accepted.");
      return;
    }
    setUploading(true);
    try {
      // presign -> direct upload to object storage -> register -> poll
      const { uploadUrl, storageKey } = await photos.presign(file.type);
      await uploadPhotoBytes(uploadUrl, file);
      await photos.register(storageKey);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function onDelete(id: number) {
    setError(null);
    try {
      await photos.remove(id);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!list && !error) return <div className="page-loading">Loading…</div>;

  const count = list?.length ?? 0;

  return (
    <div className="page">
      <h2>Your photos</h2>
      <p className="muted">
        {count}/{MAX_PHOTOS} photos. New uploads are reviewed automatically — they appear blurred
        until approved.
      </p>
      {error && <p className="error">{error}</p>}
      {count === 0 && (
        <div className="card empty-state">
          <span className="empty-state-emoji">📷</span>
          <p>No photos yet — your discovery card shows a placeholder until you add one.</p>
        </div>
      )}
      <div className="photo-grid">
        {list?.map((photo) => (
          <div key={photo.id} className={`photo-tile status-${photo.status}`}>
            <BlurhashImage
              blurhash={photo.blurhash}
              src={photo.status === "approved" ? photo.urls?.card : null}
              alt="Profile photo"
            />
            <div className="photo-meta">
              {photo.isPrimary && <span className="badge">Primary</span>}
              {photo.status === "pending" && <span className="badge pending">Reviewing…</span>}
              {photo.status === "rejected" && (
                <span className="badge rejected">Rejected — try another</span>
              )}
              <button className="link-button danger" onClick={() => onDelete(photo.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED.join(",")}
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileChosen(file);
        }}
      />
      <button
        onClick={() => fileInput.current?.click()}
        disabled={uploading || count >= MAX_PHOTOS}
      >
        {uploading ? "Uploading…" : count >= MAX_PHOTOS ? "Photo limit reached" : "Add a photo"}
      </button>
    </div>
  );
}
