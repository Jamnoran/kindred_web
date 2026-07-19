# CLAUDE.md — working notes for this repo

Kindred web: the browser client for the Kindred dating platform. React 19 +
TypeScript + Vite, react-router 7, STOMP over `/ws` for chat realtime, plain
CSS in one `src/styles.css` (dark theme default). The backend lives in a
separate repo (`kindred_backend`); this app implements the contract in that
repo's `docs/CLIENT_INTEGRATION.md`, and `src/api/types.ts` is hand-derived
from its `openapi/kindred-api.json` — diff against the spec when the backend
changes.

> **Keep this file current.** Whenever you learn something non-obvious the hard
> way — an environment quirk, a library gotcha, a convention you had to reverse-
> engineer, a decision with a non-obvious rationale — add it here (and prune
> anything this file gets wrong) in the same commit as the work. The test is:
> "would a fresh session waste tokens rediscovering this?" If yes, it belongs here.

## Build & test — read this first

- There is no test suite. Verification is `npm run build` (`tsc --noEmit` +
  `vite build`) — run it before every commit; `npm run typecheck` is the fast
  half of that.
- `npm install` works in Claude Code remote sessions (the registry is
  reachable through the egress proxy).
- Dev: `npm run dev` on http://localhost:5173. Vite proxies `/api` and `/ws`
  to `VITE_BACKEND_URL` (default `http://localhost:8080`) so the `SESSION`
  cookie (SameSite=Lax) stays same-origin. Production must be served same-site
  with the API for the same reason; `VITE_API_URL` exists for a non-own-origin
  API but a fully cross-site deploy will not get the cookie.

## Layout & conventions

- `src/api/http.ts` is the single fetch wrapper: cookie session, double-submit
  CSRF (`XSRF-TOKEN` cookie → `X-XSRF-TOKEN` header on mutations, bootstrapped
  by `GET /meta`), RFC 7807 `ProblemDetail` → `ApiError(status, problem)`, and
  a global `UNAUTHORIZED_EVENT` on any 401 that drops the session in
  `AuthContext`. All endpoints live in `src/api/endpoints.ts`, grouped by
  domain (`auth`, `profile`, `photos`, `discovery`, `premium`, `chat`).
- One file per route in `src/pages/`, routed in `App.tsx`; authenticated pages
  nest under `ProtectedLayout`. Shared bits in `src/components/`.
- Errors render inline per page (`errorMessage(err)` into a `.error <p>`);
  status-specific handling switches on `ApiError.status` — see
  `handleError` in ChatPage (404 = gone, 402 = premium).
- Styling: extend `src/styles.css` with plain classes; reuse `card`,
  `empty-state`, `chip`, `link-button`, `secondary` before adding new ones.

## Domain facts worth knowing

- **Chat realtime is notification-only and has no replay.** Sends go through
  REST; STOMP frames on `/topic/conversations/{id}` are hints. Re-sync via
  REST on every socket (re)connect (`onConnected`), dedupe REST + socket echo
  by message id (`mergeMessages`), ignore unknown `ChatEvent.type`s. Only
  subscribe to conversation ids confirmed by `GET /conversations` — the
  server closes the socket for foreign ids.
- **Media pipeline** (profile photos and chat images alike): presign → direct
  `PUT` of raw bytes to storage (no cookies/CSRF) → register/send the
  single-use storage key → poll or wait for the `media` event while the
  backend validates and re-encodes. Chat image bytes are private: signed URLs
  expire ~5 min, fetch per view and refetch on expiry (`ChatMediaImage`);
  `nsfw: true` renders only the blurhash until the viewer explicitly taps —
  never fetch early — and the conversation list shows a generic "Photo" label,
  never a thumbnail.
- **Premium gates chat images only** (text and viewing received images are
  never gated). `Conversation.imageMessagingEnabled` (true when ≥1 participant
  is premium — one purchase unlocks both) drives the UI: attach button when
  true, a 🔒 link to `/premium` when false. The server enforces it anyway:
  402 on media presign or send with `mediaStorageKey` — treat 402 as "our
  flag was stale", lock the UI and prompt the upgrade.
- **Checkout is a redirect, and the success page must not trust itself.**
  `POST /premium/checkout` → `window.location.assign(checkoutUrl)`
  (Stripe-hosted, no Stripe.js); 409 = already premium (hide/skip the buy
  button when `GET /premium` says so). Premium is granted asynchronously by
  the Stripe webhook, so `/premium/success` polls `GET /premium` until
  `premium: true` — landing there proves nothing. Once premium, refetching
  `GET /conversations` flips `imageMessagingEnabled` (ChatPage refetches on
  mount, so navigating back is enough).
- The backend's default redirect URLs point at port **3000**
  (`STRIPE_SUCCESS_URL=http://localhost:3000/premium/success`), but this dev
  server runs on **5173** — for local end-to-end checkout, set
  `STRIPE_SUCCESS_URL`/`STRIPE_CANCEL_URL` in the backend env to the
  `http://localhost:5173/premium/...` equivalents.
- **Inclusivity model** (labels in `src/inclusivity.ts`): `gender` is optional
  self-identification (`woman|man|nonbinary`, null = prefer not to say — the
  Profile chip toggles off); orientation is only ever the `genders` "show me"
  preference (multi-select, mutually enforced server-side — copy must say
  filtering hides you from people you exclude AND hides undeclared-gender
  profiles). `relationshipStyles`: the server umbrella-normalizes profile
  writes (open/polyamory ⇒ + non_monogamy) so ProfilePage adopts the response
  list after save (chips update themselves); preference filters are verbatim —
  don't "helpfully" pre-add the umbrella in the UI.
- **Location is edited on the Discover page** (`LocationSection`), not the
  profile — it changes as people move. Raw coordinates are never shown: device
  geolocation or a city picked from the bundled gazetteer (`src/cities.ts` —
  the backend has no geocoding endpoint, so city → lat/lng is resolved
  client-side; diacritic-insensitive search). The server never echoes
  coordinates back (`ProfileResponse` has only `locationSet`/`visibility`), so
  a visibility-only change can auto-resave just with coords picked earlier in
  the same session; otherwise it applies on the next location update. Saving
  refetches the deck — DiscoveryPage's loading state must only replace the
  deck area, never early-return the whole page, or LocationSection unmounts
  mid-save and loses its editor state.
- 404 on a conversation means "not a member or deleted" — indistinguishable
  by design; don't try to tell them apart in copy.
- **Notification emails deep-link to `/conversations/{id}`** (backend
  `EmailNotificationChannel`), which the client keeps as a redirect alias for
  `/chats/:id` — don't rename either path without changing the other side.
  Logged-out deep links round-trip through login via `location.state.from`
  (ProtectedLayout → LoginPage). `PUT /notification-preferences` is a **full
  replace**: always send the entire grid; omitted type/channel pairs reset to
  enabled. The grid is server-driven — never hardcode the type/channel lists
  in the UI (unknown values render via `humanize()` in PreferencesPage).
