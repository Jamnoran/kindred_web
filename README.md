# Kindred Web

Web client for the [Kindred backend](https://github.com/Jamnoran/kindred_backend),
built with React + TypeScript + Vite. Implements the flows described in the
backend's `docs/CLIENT_INTEGRATION.md` (Phases 0–3): auth, profile/onboarding,
photos, discovery/matching, and realtime chat.

## Running

Start the backend first (`docker compose up` in the backend repo, serves
`http://localhost:8080`), then:

```bash
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` and `/ws` to the
backend so the `SESSION` cookie (SameSite=Lax) stays same-origin. Point the
proxy at a different backend with `VITE_BACKEND_URL=http://host:port npm run dev`.

For a production build (`npm run build`), serve the app same-site with the API
(same domain or sibling subdomains behind one site) — a fully cross-site
deployment will not receive the session cookie. `VITE_API_URL` can be set at
build time if the API is not on the app's own origin.

## How it maps to the backend

- **Sessions/CSRF** — `src/api/http.ts`: cookie-based session, `X-XSRF-TOKEN`
  double-submit header on all mutating calls, CSRF bootstrap via `GET /meta`,
  RFC 7807 problem details, global 401 → login redirect.
- **Auth** — signup, email verification landing page (`/verify-email?token=…`),
  resend, login (403 = unverified email), session restore via `GET /auth/me`.
- **Onboarding** — profile (full-replace `PUT /profile`), interest taxonomy
  from `GET /interests`, location with `exact/approximate/hidden` visibility.
- **Photos** — presign → direct `PUT` to storage → register → poll until
  approved/rejected; blurhash placeholders (`src/components/BlurhashImage.tsx`).
- **Discovery** — card deck with like/superlike/pass, the transparent
  "Why this person?" factor breakdown always rendered, match modal that jumps
  straight into the already-created conversation.
- **Preferences** — read-modify-write full replace of filters + scoring weights.
- **Chat** — REST for history (newest-first keyset pagination) and sends;
  STOMP over `/ws` (`src/realtime/stomp.ts`) for message/read/typing/media/presence
  events with auto-reconnect, REST re-sync on every (re)connect (the relay has
  no replay), dedupe by message id, throttled typing signals, client-side typing
  expiry, and unknown event types ignored.
- **Chat images** — presign scoped to the conversation → direct `PUT` to
  storage → message with `mediaStorageKey`; pending placeholder until the
  `media` event resolves to approved/rejected. Bytes are private: signed URLs
  (~5 min) are fetched per view when the image scrolls into sight and refetched
  on expiry (`src/components/ChatMediaImage.tsx`). NSFW images render only the
  blurhash until explicitly tapped — per image, never fetched early — and the
  conversation list shows a generic "Photo" label instead of any thumbnail.
- **Presence** — `online` flag from `GET /conversations` shown as a dot in the
  list and chat header, kept live by `presence` events while subscribed.

## API types

`src/api/types.ts` is hand-derived from `openapi/kindred-api.json` in the
backend repo — diff against the spec when the backend changes.
