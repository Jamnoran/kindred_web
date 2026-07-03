import { api } from "./http";
import type {
  Conversation,
  DiscoveryCard,
  Interest,
  Message,
  NearbyProfile,
  PhotoResponse,
  PreferencesResponse,
  ProfilePhotoUploadResponse,
  ProfileResponse,
  ReactResponse,
  ReactionKind,
  ReceivedLike,
  UpdateLocationRequest,
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

/** Step 2 of the pipeline: raw bytes to object storage — no cookies, no CSRF. */
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

// --- chat ---
export const chat = {
  conversations: () => api<Conversation[]>("/conversations"),
  /** Newest first; pass the smallest id you have as `before` to page older. */
  messages: (conversationId: number, limit = 50, before?: number) =>
    api<Message[]>(
      `/conversations/${conversationId}/messages?limit=${limit}${before ? `&before=${before}` : ""}`,
    ),
  send: (conversationId: number, body: string) =>
    api<Message>(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: { body },
    }),
  markRead: (conversationId: number) =>
    api<{ markedRead: number }>(`/conversations/${conversationId}/read`, { method: "POST" }),
};
