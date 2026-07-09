---
name: verify
description: Build, launch, and drive kindred_web end-to-end in this environment (mock backend + headless chromium).
---

# Verifying kindred_web changes at runtime

There is no test suite; `npm run build` only proves it compiles. To observe
behavior, run the real app against a mock backend and drive it with Playwright.

## Recipe that works in Claude Code remote sessions

1. `npm install` then `npm run dev` (background) — Vite on :5173 proxies
   `/api` and `/ws` to `http://localhost:8080`.
2. Write a plain-Node mock backend on :8080 implementing just the endpoints
   the flow under test touches. Contract essentials the app depends on:
   - `GET /api/v1/meta` must `Set-Cookie: XSRF-TOKEN=...` (CSRF bootstrap).
   - `POST /api/v1/auth/login` sets a `SESSION` cookie; `GET /api/v1/auth/me`
     returns 401 without it (that 401 is what renders the login page).
   - Mutations arrive with `X-XSRF-TOKEN` — assert it in the mock.
   - `/ws` (STOMP) can be absent; chat degrades gracefully without realtime.
3. Drive with `playwright-core` (`npm i playwright-core` in the scratchpad,
   NOT in this repo). Launch with
   `executablePath: "/opt/pw-browsers/chromium"` — the pre-installed browser
   is at that symlink, and `playwright install` is forbidden here.
4. Capture screenshots + log request bodies via `page.on("request", ...)` to
   assert what the app actually sent (e.g. full-grid PUTs, CSRF header).

## Gotchas

- `.notif-row:first-child`-style selectors fail inside `fieldset` (legend is
  the first child); prefer `:has-text(...)` locators.
- Simulate API failure with `page.route(url, route => route.abort())` to test
  error paths (inline `.error` + state revert).
