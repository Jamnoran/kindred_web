// Types hand-derived from openapi/kindred-api.json in the backend repo.
// Regenerate/diff against the spec when the backend changes.

export interface UserResponse {
  id: number;
  email: string;
  emailVerified: boolean;
}

export interface SignupRequest {
  email: string;
  password: string;
  /** YYYY-MM-DD */
  dob: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface Interest {
  slug: string;
  label: string;
}

export type LocationVisibility = "exact" | "approximate" | "hidden";

export interface ProfileResponse {
  userId: number;
  displayName: string | null;
  bio: string | null;
  lookingFor: string[];
  interests: string[];
  locationSet: boolean;
  locationVisibility: LocationVisibility | null;
  lastActiveAt: string | null;
}

export interface UpdateProfileRequest {
  displayName: string;
  bio?: string;
  lookingFor?: string[];
  interests?: string[];
}

export interface UpdateLocationRequest {
  lat: number;
  lng: number;
  visibility?: LocationVisibility;
}

export interface Weights {
  interests: number;
  distance: number;
  activity: number;
  mutualFit: number;
}

export interface PreferencesResponse {
  distanceKm: number;
  ageMin: number;
  ageMax: number;
  lookingFor: string[];
  dealbreakers: string[];
  weights: Record<string, number>;
}

export type UpdatePreferencesRequest = PreferencesResponse;

export type PhotoStatus = "pending" | "approved" | "rejected";

export interface PhotoUrls {
  thumb: string;
  card: string;
  full: string;
}

export interface PhotoResponse {
  id: number;
  status: PhotoStatus;
  isPrimary: boolean;
  sortOrder: number;
  blurhash: string | null;
  urls: PhotoUrls | null;
}

export interface PhotoSummary {
  urls: PhotoUrls | null;
  blurhash: string | null;
}

export interface ProfilePhotoUploadResponse {
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
}

export type ReactionKind = "like" | "superlike" | "pass";

export interface ReactResponse {
  matched: boolean;
  matchId: number | null;
  conversationId: number | null;
}

export interface ReceivedLike {
  userId: number;
  displayName: string;
  kind: ReactionKind;
  likedAt: string;
  photo: PhotoSummary | null;
}

export interface Factors {
  sharedInterests: string[];
  interestScore: number;
  distanceKm: number | null;
  distanceScore: number;
  daysSinceActive: number;
  activityScore: number;
  mutualFitScore: number;
  weights: Weights;
  total: number;
}

export interface DiscoveryCard {
  userId: number;
  displayName: string;
  age: number;
  bio: string | null;
  lookingFor: string[];
  interests: string[];
  photo: PhotoSummary | null;
  distanceKm: number | null;
  score: number;
  whyThisPerson: Factors;
}

export interface NearbyProfile {
  userId: number;
  displayName: string;
  distanceKm: number;
}

export type ChatMediaStatus = "pending" | "approved" | "rejected";

/**
 * Image attached to a chat message. Bytes are never public: fetch short-lived
 * signed URLs per view via GET /conversations/{id}/media/{mediaId}.
 * When `nsfw` is true the client MUST NOT fetch the bytes until the viewer
 * explicitly taps to reveal — render only the blurhash.
 */
export interface ChatMediaSummary {
  id: number;
  status: ChatMediaStatus;
  nsfw: boolean;
  blurhash: string | null;
}

export interface ChatMediaUploadResponse {
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
}

export interface ChatMediaUrlsResponse {
  mediaId: number;
  urls: PhotoUrls;
  /** Signed URLs expire ~5 min after issue; refetch instead of persisting. */
  expiresAt: string;
}

export interface Message {
  id: number;
  senderId: number;
  /** Null for media-only messages. */
  body: string | null;
  media: ChatMediaSummary | null;
  createdAt: string;
  readAt: string | null;
}

export interface ConversationParticipant {
  userId: number;
  displayName: string;
  photo: PhotoSummary | null;
  /** Initial presence; kept live by "presence" ChatEvents while subscribed. */
  online: boolean;
}

export interface Conversation {
  id: number;
  matchId: number;
  matchedAt: string;
  otherUser: ConversationParticipant;
  lastMessage: Message | null;
  unreadCount: number;
}

/** One frame on /topic/conversations/{id}. Unknown types must be ignored. */
export interface ChatEvent {
  type: "message" | "read" | "typing" | "media" | "presence" | (string & {});
  conversationId: number;
  message: Message | null;
  readerId: number | null;
  typingUserId: number | null;
  /** "media" events: an image finished processing (approved/rejected). */
  media: ChatMediaSummary | null;
  /** "presence" events: presenceUserId went online/offline. */
  presenceUserId: number | null;
  online: boolean | null;
}

/** RFC 7807 problem detail. */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
}
