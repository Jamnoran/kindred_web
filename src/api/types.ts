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

/**
 * Optional and self-identified (null = prefer not to say); no separate trans
 * categories by design. Orientation is never a profile label — it's the
 * `genders` ("show me") preference filter, enforced mutually in discovery.
 */
export type Gender = "woman" | "man" | "nonbinary";

/**
 * Multi-select. `non_monogamy` is the ethical-non-monogamy umbrella: the server
 * auto-adds it to profiles declaring `open` or `polyamory` (responses come back
 * normalized). Preference filters keep their literal meaning — `polyamory`
 * filters to specifically-poly people, `non_monogamy` to anyone ENM.
 */
export type RelationshipStyle = "monogamy" | "non_monogamy" | "open" | "polyamory";

export interface ProfileResponse {
  userId: number;
  displayName: string | null;
  bio: string | null;
  gender: Gender | null;
  lookingFor: string[];
  relationshipStyles: RelationshipStyle[];
  interests: string[];
  locationSet: boolean;
  locationVisibility: LocationVisibility | null;
  /**
   * Coarse human-readable place name ("Malmö"), reverse-geocoded server-side.
   * Never coordinates. Null when no location is set (or on backends predating
   * the location-label change).
   */
  locationLabel: string | null;
  lastActiveAt: string | null;
}

export interface UpdateProfileRequest {
  displayName: string;
  bio?: string;
  gender?: Gender | null;
  lookingFor?: string[];
  relationshipStyles?: RelationshipStyle[];
  interests?: string[];
}

export interface UpdateLocationRequest {
  /**
   * lat/lng come as a pair — both or neither. Omit the pair to change
   * visibility only; the server keeps its stored coordinates (422 when no
   * location was ever set).
   */
  lat?: number;
  lng?: number;
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
  /**
   * "Show me" — empty means everyone. The one MUTUALLY enforced filter: you
   * never see someone whose own filter excludes you, and setting it also hides
   * profiles with no declared gender (both directions).
   */
  genders: Gender[];
  lookingFor: string[];
  /** Candidates who declared no styles still appear (same as lookingFor). */
  relationshipStyles: RelationshipStyle[];
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
  gender: Gender | null;
  lookingFor: string[];
  relationshipStyles: RelationshipStyle[];
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
  /**
   * True when at least one participant is premium — then both can send
   * images. When false, hide attach controls and offer the upgrade; the
   * server also enforces it (402 on presign and on send with
   * mediaStorageKey). Text and viewing received images are never gated.
   */
  imageMessagingEnabled: boolean;
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

/**
 * Offline-notification preference grid. Types and channels are open unions:
 * render whatever the server sends so new values (push, digests, …) appear
 * without a client change.
 */
export type NotificationType = "new_match" | "new_message" | (string & {});
export type NotificationChannel = "email" | (string & {});

export interface NotificationPreferenceEntry {
  type: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}

/**
 * PUT is a full replace: send back the ENTIRE grid with toggles flipped —
 * any type/channel pair omitted resets to enabled. Duplicate pairs → 400.
 */
export interface UpdateNotificationPreferencesRequest {
  preferences: NotificationPreferenceEntry[];
}

export interface NotificationPreferencesResponse {
  preferences: NotificationPreferenceEntry[];
}

export interface PremiumStatusResponse {
  premium: boolean;
  /** Set once by the Stripe webhook; never expires. Null while free. */
  premiumSince: string | null;
}

export interface CheckoutSessionResponse {
  /** Stripe-hosted Checkout page — redirect the whole browser here. */
  checkoutUrl: string;
}

/** Profile of a matched user — returned by GET /profiles/{userId}. */
export interface MatchProfileResponse {
  userId: number;
  displayName: string;
  age: number;
  bio: string | null;
  gender: Gender | null;
  lookingFor: string[];
  relationshipStyles: RelationshipStyle[];
  interests: string[];
  photo: PhotoSummary | null;
}

/** RFC 7807 problem detail. */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
}
