import { api } from "./http";
import type {
  ChatMediaUploadResponse,
  ChatMediaUrlsResponse,
  CheckoutSessionResponse,
  Conversation,
  DiscoveryCard,
  Interest,
  MatchProfileResponse,
  Message,
  NearbyProfile,
  NotificationPreferencesResponse,
  PhotoResponse,
  PreferencesResponse,
  PremiumStatusResponse,
  ProfilePhotoUploadResponse,
  ProfileResponse,
  ReactResponse,
  ReactionKind,
  ReceivedLike,
  UpdateLocationRequest,
  UpdateNotificationPreferencesRequest,
  UpdatePreferencesRequest,
  UpdateProfileRequest,
  UserResponse,
} from "./types";

// --- auth ---
export const auth = {
  signup: (email: string, password: string, dob: string) =>
    api<UserResponse>("/auth/signup", { method: "POST", body: { email, password, dob } }),
  verifyEmail: (token: string) =>
    api<null>("/auth/verify-email", { method: "POST", body: { token } }),
  resendVerification: (email: string) =>
    api<null>("/auth/resend-verification", { method: "POST", body: { email } }),
  login: (email: string, password: string) =>
    api<UserResponse>("/auth/login", { method: "POST", body: { email, password } }),
  me: () => api<UserResponse>("/auth/me"),
  logout: () => api<null>("/auth/logout", { method: "POST" }),
};

// --- profile & onboarding ---
export const profile = {
  get: () => api<ProfileResponse>("/profile"),
  update: (body: UpdateProfileRequest) =>
    api<ProfileResponse>("/profile", { method: "PUT", body }),
  updateLocation: (body: UpdateLocationRequest) =>
    api<ProfileResponse>("/profile/location", { method: "PUT", body }),
  interests: () => api<Interest[]>("/interests"),
  nearby: (radiusKm: number) =>
    api<NearbyProfile[]>(`/profiles/nearby?radiusKm=${radiusKm}`),
  /** Profile of a matched user. 404 if no match exists. */
  getMatch: (userId: number) => api<MatchProfileResponse>(`/profiles/${userId}`),
};

// --- photos (presign -> direct upload -> register -> poll) ---
export const photos = {
  list: () => api<PhotoResponse[]>("/photos"),
  presign: (contentType: string) =>
    api<ProfilePhotoUploadResponse>("/media/profile-photo-uploads", {
      method: "POST",
      body: { contentType },
    }),
  register: (storageKey: string) =>
    api<PhotoResponse>("/photos", { method: "POST", body: { storageKey } }),
  remove: (id: number) => api<null>(`/photos/${id}`, { method: "DELETE" }),
};

/**
 * Step 2 of both media pipelines (profile photos and chat images):
 * raw bytes to object storage — no cookies, no CSRF.
 */
export async function uploadPhotoBytes(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed (HTTP ${res.status})`);
}

// --- discovery & matching ---
export const discovery = {
  deck: (limit = 20) => api<DiscoveryCard[]>(`/discovery?limit=${limit}`),
  preferences: () => api<PreferencesResponse>("/preferences"),
  updatePreferences: (body: UpdatePreferencesRequest) =>
    api<PreferencesResponse>("/preferences", { method: "PUT", body }),
  react: (toUserId: number, kind: ReactionKind) =>
    api<ReactResponse>("/likes", { method: "POST", body: { toUserId, kind } }),
  likesReceived: () => api<ReceivedLike[]>("/likes/received"),
};

// --- premium (one-time upgrade; unlocks image messaging for both sides) ---
export const premium = {
  status: () => api<PremiumStatusResponse>("/premium"),
  /**
   * 201 with the Stripe Checkout URL; 409 if already premium. Premium is
   * granted only by the Stripe webhook — never by the success redirect.
   */
  checkout: () =>
    api<CheckoutSessionResponse>("/premium/checkout", { method: "POST" }),
};

// --- notifications (offline email alerts; PUT is a full grid replace) ---
export const notifications = {
  preferences: () =>
    api<NotificationPreferencesResponse>("/notification-preferences"),
  updatePreferences: (body: UpdateNotificationPreferencesRequest) =>
    api<NotificationPreferencesResponse>("/notification-preferences", {
      method: "PUT",
      body,
    }),
};

// --- chat ---
export const chat = {
  conversations: () => api<Conversation[]>("/conversations"),
  /** Newest first; pass the smallest id you have as `before` to page older. */
  messages: (conversationId: number, limit = 50, before?: number) =>
    api<Message[]>(
      `/conversations/${conversationId}/messages?limit=${limit}${before ? `&before=${before}` : ""}`,
    ),
  /** At least one of body / mediaStorageKey is required. */
  send: (conversationId: number, message: { body?: string; mediaStorageKey?: string }) =>
    api<Message>(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: message,
    }),
  markRead: (conversationId: number) =>
    api<{ markedRead: number }>(`/conversations/${conversationId}/read`, { method: "POST" }),
  /** Chat image step 1: presign an upload scoped to this conversation. */
  presignMedia: (conversationId: number, contentType: string) =>
    api<ChatMediaUploadResponse>(`/conversations/${conversationId}/media-uploads`, {
      method: "POST",
      body: { contentType },
    }),
  /**
   * Signed display URLs for an approved image; they expire in ~5 minutes, so
   * fetch on view and refetch after expiry. 409 = still processing, 404 = gone.
   */
  mediaUrls: (conversationId: number, mediaId: number) =>
    api<ChatMediaUrlsResponse>(`/conversations/${conversationId}/media/${mediaId}`),
};
