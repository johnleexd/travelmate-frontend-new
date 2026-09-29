# TravelMate frontend deployment runbook

Deploy this Next.js application to a Node.js 22-compatible platform with HTTPS.
The frontend and API may use different hosts, but the API must explicitly allow
the frontend's exact HTTPS origin.

## Required production environment

- Set server-only `BACKEND_URL` to the public HTTPS API origin with no trailing
  path, for example `https://api.example.com`.
- Do not expose database, session, email, AI, weather, Amadeus, or payment secrets
  to the frontend environment.
- Configure the matching frontend origin in the backend `FRONTEND_URL` allowlist.

The application redirects production HTTP requests to HTTPS with status 308 and
serves HSTS on every route. Keep the hosting platform's automatic certificate
renewal and HTTP-to-HTTPS redirect enabled as the outermost TLS boundary.

## Release sequence

1. Deploy the compatible backend revision and migrations first; confirm its
   `/health` response is healthy.
2. Confirm the frontend CI workflow passes, including the isolated Playwright job.
3. Install locked dependencies with `npm ci` and build with `npm run build` using
   the production `BACKEND_URL`.
4. Deploy the immutable frontend revision and start it with `npm start` when the
   platform does not manage Next.js startup automatically.
5. Verify `/`, `/dashboard`, and `/admin/dashboard` are served
   over HTTPS and that unauthenticated dashboard visits redirect safely.

## Production smoke test

Run the complete flow from section 77 of the repository `MASTERPROMPT.md`, with
special attention to:

- registration, verification, login, logout, and password recovery;
- itinerary generation, explicit provider source, failure retry, and preservation
  of an already displayed plan;
- PHP, USD, EUR, and JPY display without implicit currency conversion;
- save, reload, manual edit, update/regenerate, duplicate, and delete;
- responsive navigation at 390px plus admin tablet widths;
- explicit unavailable states for external services rather than invented data.

Record the release revision, environment, time, test account, and result. Delete
temporary smoke data afterward.

## Rollback

1. Restore the last known-good immutable frontend revision through the hosting
   platform.
2. Do not roll back the API or database merely for a frontend-only rendering
   regression unless contract compatibility requires it.
3. Re-run landing, login, dashboard, and saved-trip retrieval smoke checks before
   marking rollback complete.
