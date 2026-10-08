# TravelMate frontend deployment runbook

Deploy this Next.js application to a Node.js 22-compatible platform with HTTPS.
The frontend and API may use different hosts, but the API must explicitly allow
the frontend's exact HTTPS origin.

## Required production environment

- Set server-only `BACKEND_URL` to the public HTTPS API origin with no trailing
  path, for example `https://api.example.com`. A private HTTP Docker/service
  origin is also supported when the backend is reachable only through trusted
  proxies. Google OAuth forwards the verified outer protocol and client IP.
- Do not expose database, session, email, AI, weather, Amadeus, or payment secrets
  to the frontend environment.
- Configure the matching frontend origin in the backend `FRONTEND_URL` allowlist.

The application redirects production HTTP application/API routes to HTTPS with status 308 and
serves HSTS on every route. Keep the hosting platform's automatic certificate
renewal and HTTP-to-HTTPS redirect enabled as the outermost TLS boundary.
Keep the Next Node port private. The outer proxy must overwrite `X-Forwarded-Proto`
and `X-Forwarded-For`, rather than trusting caller-supplied values. The backend's
one-hop proxy trust assumes its immediate proxy is trusted; restrict direct backend
access accordingly. Public static assets bypass application redirects so Next's
internal image optimizer can read them; the outer proxy still enforces public HTTPS.

## Paired backend in CI

CI resolves the latest successful push of the backend CI workflow on `main` to
its full commit SHA, then checks out that immutable revision. To pair with a
particular deployed release instead, set `BACKEND_REVISION` to its full
40-character SHA; a manual run may override it with `backend_revision`.
`BACKEND_REPOSITORY` defaults to the current backend
origin, `Unpayedme/travelmate-backend-api`; set the variable explicitly if the
deployment uses another repository. A private backend requires `BACKEND_REPO_TOKEN`
with Contents read for checkout and Actions read for automatic revision resolution.
The [workflow-runs API](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow)
provides the successful run's `head_sha`. CI fails early if no suitable revision is
available, records the checked-out SHA,
and compares API contracts before executing the browser suite. Update this pairing
when a pinned backend release changes. Publish compatible backend changes first;
CI never silently checks out a moving backend branch.

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

Use the release checklist in `../PRODUCT_BASELINE.md`, with special attention to:

- registration, verification, login, logout, and password recovery;
- itinerary generation, explicit provider source, failure retry, and preservation
  of an already displayed plan;
- PHP, USD, EUR, and JPY display without implicit currency conversion;
- save, reload, manual edit, update/regenerate, duplicate, and delete;
- responsive navigation at 390px plus admin tablet widths;
- explicit unavailable states for external services rather than invented data.

Record the release revision, environment, time, test account, and result. Delete
temporary smoke data afterward.

After building, `npm run test:production` starts an isolated production Next server
and a local fake OAuth upstream. It verifies redirects, optimized images, and OAuth
forwarding without contacting a real backend, Google, or a database. For a local
check alongside an active development server, set `TRAVELMATE_ISOLATED_BUILD=true`
for both `npm run build` and `npm run test:production`; this uses `.next-production`
instead of overwriting the development build directory.

## Rollback

1. Restore the last known-good immutable frontend revision through the hosting
   platform.
2. Do not roll back the API or database merely for a frontend-only rendering
   regression unless contract compatibility requires it.
3. Re-run landing, login, dashboard, and saved-trip retrieval smoke checks before
   marking rollback complete.
