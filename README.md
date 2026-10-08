# TravelMate Next.js frontend

This project contains only the TravelMate browser UI. It uses Next.js, React,
and strict TypeScript. Backend requests to `/api/*` are rewritten to the Express
service configured by `BACKEND_URL` (default `http://localhost:5000`).

“Use manually” resolves a destination through the backend before showing it as
confirmed. Both selection paths then detect a supported country currency and
search accommodation with the same coordinates/dates/traveler parameters.
Ambiguous names require a choice; country/region/island selections expose city
narrowing. Mapped properties show their actual locations with unconfirmed prices
and availability. Missing Amadeus keys affect room quotes, not mapped discovery.

Country, region and island selections immediately show a searchable list of
verified cities/towns, with descriptions and additional pages. Selecting a city
automatically starts its accommodation search. “Help me choose” compares mapped
interest samples and the entered budget allowance without selecting a city or
claiming confirmed prices. Loading, empty and provider-error states are distinct;
area requests are cached and shared, and budget/interest edits do not refetch
geography. The backend owns all geographic validation and provider requests.

## Project structure

The frontend follows the feature-oriented organization used by the referenced
portfolio project while retaining TravelMate's existing App Router URLs:

```text
app/                 Route groups, route entry points, and framework boundaries
components/
|-- common/          Shared application components
|-- features/        Complete feature and role-specific screens
|-- provider/        Client/runtime providers
`-- ui/              Reusable UI primitives
constants/           Static product data and design tokens
hooks/               Shared React hooks
lib/                 Pure domain and itinerary utilities
services/            Backend API and provider-response adapters
styles/              Global Tailwind and design-system styles
public/              Static images and icons
tests/               Fast unit and contract tests
e2e/                 Playwright user-flow tests
```

Files under `app` stay intentionally thin: they define URLs and render feature
screens from `components/features`. Browser-to-backend communication is isolated
in `services`, while deterministic calculations remain in `lib`.

Run development from this directory:

```powershell
npm.cmd run dev
```

This starts the sibling `../travelmate-backend-api` automatically, waits for its
API to respond, then starts Next.js. An already running API is reused. Ctrl+C
stops the processes started by this command. Install the backend dependencies
and configure its `.env` with `DATABASE_URL` before the first run.
`BACKEND_URL` in `.env.local` selects the API address (default port 5000).
For a separately managed backend, `npm.cmd run dev:frontend` starts only Next.js.

## Automated checks

Run the fast frontend checks with:

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

The Playwright suite uses the installed stable Google Chrome and starts the
frontend/backend automatically when they are not already running:

```powershell
npm.cmd run test:e2e
```

The complete E2E suite requires a reachable, isolated test database with seeded
traveler and admin accounts. Set `TRAVELMATE_ALLOW_DEMO_SEED=true` and distinct,
strong `DEMO_ADMIN_PASSWORD` / `DEMO_TRAVELER_PASSWORD` values of 16–64 characters
when seeding the backend. Export the same passwords in the terminal running
Playwright. There are no default login passwords. The suite creates temporary
trip records and removes them after the persistence tests.

Saved-trip Edit opens a modal showing the saved hotel, trip summary, and each day's
activities. Activity edits, additions, removal, and reordering stay in a local draft
until Save changes succeeds. Cancel and Escape protect unsaved edits with a discard
choice. Load and save failures can be retried without losing the draft. Changing
destination, dates, travelers, or accommodation uses Change trip details to open
the existing planner and regenerate an updated itinerary.

Saved-trip View includes an interactive destination map. Show my location requests
browser permission and displays live device location, reported accuracy, and a
clearly labeled straight-line distance. Stop sharing, leaving the view, or hiding
the tab clears tracking; coordinates stay in memory and are not written to a trip.
Get directions opens Google Maps with the current coordinates and saved destination.
Legacy trips without coordinates use their recorded grounded destination or offer a
destination-name directions link. Map tiles use OpenStreetMap with visible attribution.
Geolocation requires HTTPS (or localhost) and enabled browser/device location services.

GPS navigation has its own satellite-fix/arrow icon in the traveler sidebar. Opening
it requests location permission and shows a live marker. Search destination runs an
explicit place/address lookup; selecting a result, clicking the map, or using its
center sets the destination. Walking, cycling and driving use actual OSRM datasets.
Show route draws the returned path and lists maneuvers. Start guidance follows the
user, advances the next instruction and reroutes after meaningful off-route movement
(at least 30 m, no more than once per 15 seconds). Poor accuracy and lost signals are
shown explicitly; hiding/leaving the tool stops sharing and cancels pending routing.
Saved-trip maps can open GPS with their recorded destination. GPS navigation does
not modify plans or mark places visited. TravelMate does not save location history;
route endpoints are sent to the routing provider, which may log queries. Times are
estimates without live traffic. See the backend README for provider configuration.

## Continuous integration

`.github/workflows/ci.yml` runs lint, unit tests, and the production build, then
runs the complete Playwright suite against an ephemeral PostgreSQL 16 database.
The E2E job checks out `Unpayedme/travelmate-backend-api` by default, with an
immutable SHA from its latest successful backend CI run on `main`. Override the
repository with `BACKEND_REPOSITORY` and pin a deployed commit with `BACKEND_REVISION`
when needed. It records the selected revision, compares the API contracts,
applies all migrations, generates unique test passwords, seeds demo users/listings, starts both
services, and uploads Playwright diagnostics for seven days.

If the backend repository is private, configure a frontend repository secret named
`BACKEND_REPO_TOKEN` with fine-grained, read-only Contents and Actions access to that backend.
No Neon, email, AI, weather, Amadeus, or payment credentials are required by CI;
external-provider behavior is exercised through deterministic unavailable/mock
paths and browser interception.

See `DEPLOYMENT.md` for production environment boundaries, release ordering,
the implementation-baseline smoke checklist, and frontend rollback steps.

The quality job also runs `npm run test:production` after building, exercising
HTTPS redirects, optimized local images, and Google OAuth forwarding to a fake
internal HTTP upstream. The temporary local brace-tool patch is documented in
`vendor/braces/README.md`; it retains the upstream MIT license and has regression tests.

See `docs/ACCESSIBILITY_AUDIT.md` for verified keyboard behavior and the remaining
manual NVDA/VoiceOver sign-off checklist.

The backend provides authentication, planning, weather, booking, and dashboard
data. `npm.cmd run dev` starts it automatically for local development.

## Demonstrable workflow

The traveler dashboard presents the MVP as one lifecycle rather than unrelated
tools: **Define → Generate → Understand → Refine → Save → Reopen**. Budget,
travel options, weather, and crowd context are evidence used to review the same
trip; they are not separate workflows.

1. Register as a traveler and enter the verification code received by email.
2. Sign in, search for a destination, and explicitly choose one structured location
   suggestion. TravelMate derives the supported local currency from its country code,
   loads destination-relevant transportation guidance, and searches Amadeus hotel
   availability for the selected coordinates and dates. Complete the 1–31 day range,
   group budget, party, interests, travel style, activities, and optional preferences.
3. Generate a structured itinerary, review date-matched weather availability,
   estimated crowd levels, estimated activity costs, and the deterministic budget summary.
   Supported destination currencies keep one ISO currency throughout generation,
   editing, saving, reloading, and display; unsupported countries expose a manual
   currency fallback, and mismatched provider offers are not silently converted.
4. Save the plan. The Trips area supports view, edit/regenerate, update, duplicate,
   and delete operations backed by Neon PostgreSQL.

## Capstone demonstration configuration

| Capability | Controlled demonstration | Production proof required |
| --- | --- | --- |
| Authentication | Seeded traveler or email-verified registration | Verified Resend sender and real-inbox delivery |
| AI itinerary | Explicit `AI_MOCK_FALLBACK=true` outside production | OpenAI or Gemini key; fallback disabled |
| Weather | Keyless Open-Meteo or explicit unavailable response | Provider success and failure smoke checks |
| Flights and hotels | Amadeus test credentials or explicit unavailable response | Chosen live/test mode and provider smoke checks |
| Crowd context | Clearly labeled calendar estimate with retrieval/refresh times and manual condition refresh | A live crowd provider remains optional; never present estimates as live foot traffic |
| Payments | Clearly labeled simulation only | Out of MVP scope until a complete payment integration exists |

Never use production secrets for the controlled capstone demonstration. The
release owner must complete the live-provider and HTTPS checks in
`../CAPSTONE_READINESS_TRACKER.md` before describing the system as production-ready.

## Data-source honesty

- Itineraries are labeled OpenAI, Gemini, or explicit development demo fallback.
  Configured-provider failures keep the current itinerary visible and offer a retry;
  they never masquerade as a newly generated mock plan.
- AI schedules backend-supplied place IDs; it does not invent prices or place facts.
  Selected city/country/coordinates and starting location accompany generation.
  Exact place-linked Commons photos include attribution; unavailable photos use
  placeholders. Place references can be sparse and are not live venue information.
- Unavailable accommodation, meal, activity and local-transport prices use clearly
  labeled budget allowances or user-entered estimates with calculation/source
  details. Optional expense assumptions set rooms, nightly/daily rates, shared or
  per-person fare basis, extra fees and contingency. The backend computes group
  totals and per-traveler shares, including contingency. Missing prices/fees keep
  affordability unconfirmed, even when the allowances fit the entered budget.
- Open-Meteo/OpenWeatherMap weather is live provider data, but a forecast is shown
  only when the selected dates are within the provider forecast window.
- Crowd levels are calendar-based estimates and are never labeled as live foot traffic.
- Weather and crowd snapshots show retrieval/refresh times. Refreshing conditions
  replaces advisory metadata only and preserves manually edited itinerary content.
- TravelMate stays are owner/database listings. Amadeus offers are labeled test or live.
- Flight comparison is available through normalized Amadeus offers. Real payment
  processing is not integrated; payment states remain a labeled simulation.
- Production account verification and password recovery use expiring single-use
  codes through the configured transactional email provider. Development returns
  clearly identified test codes when email delivery is not configured.

The planner includes a responsive infinite carousel of six famous landmarks with attributed Commons photos and official visitor guides. Arrows, keyboard navigation, and touch swipes wrap in both directions; dots select a landmark directly. The strip keeps six unique cards and hides the horizontal scrollbar. Clicking a card opens a preview; Plan a visit resolves the correct city and country through the location service and adds the landmark to preferences. Optional expense controls remain in a collapsed Budget details panel. The planner’s starting location uses manual city search; the current-location action remains available in Travel options.

Saved trips have Active, Completed and Archived filters. Mark as done persists the completion date, itinerary and selected hotel. Mark as not done reopens the plan; archiving and restoring retain completion. Viewing completed travel loads a separate planning draft so a new save cannot overwrite its record.


## Planning and visited-place improvements (2026-10-08)

- Paid subscriptions are excluded at the user's request. No paid plans, checkout, billing status, or entitlements are implemented.
- Cloudinary is not configured: no SDK, integration, cloud name, or credentials were found in the code or environment. Licensed Commons and local images use Next's responsive optimizer at quality 75, AVIF/WebP negotiation, four-hour minimum server cache, native lazy loading, eager modal heroes, stable placeholders and retry fallbacks. Real-provider hotel photos continue to display directly under provider terms; URL metadata and attribution are preserved without downloading/storing hotel images.
- An optional starting city is in the planner and is sent to the grounded AI request even without a flight selection. The same origin remains available in flight comparison. It gives departure context; intercity arrival times and routes are not claimed as verified.
- Travel pace caps catalog stops at 2 (relaxed), 3 (balanced), or 4 (active) per day. Relaxed schedules add a 30-minute transfer buffer. The existing city/country grounding, duplicate-place, opening-reference, date and party checks remain in place.
- Daily cards and details show activity order, proposed local time, duration, location, photo/fallback, source-aware cost, map and explicit visit controls. Timing-only edits retain verified place/photo data. Custom identity changes remove verification. Reordering reschedules timed stops; legacy visits get an explicit 30-minute estimate requiring review. Browser and server enforce same-day duration and transfer/overlap checks. Buffers based on straight-line walking are estimates, not live routes. Flexible entries and daily allowances have no fixed time slot.
- Save retries use a canonical content hash by default, or a payload-bound saveKey. The database unique key is per user; concurrent retries return one saved trip and create one version. Use Duplicate for an intentional identical copy. Existing historical trips remain untouched.
- Visited places are stored separately from saved/completed plans. Recording a visit requires an explicit past/current date. Unique user/place/date keys prevent duplicates and retain return visits on different dates. Known Wikidata identities and coordinates are derived only from server-signed saved itineraries. Manual records are labeled as entered by the user. History supports search, pagination, removal and reopening an associated trip; deleting a trip retains its visits with the association cleared.
- Visit opens Google Maps directly using verified coordinates or place plus destination. It never records a visit. Mark as visited is a separate confirmation. Save itinerary changes before recording a place from that plan; stale activity identity is rejected.
- Traveler navigation now includes Visited places, Preferences and Feedback, preserving Home, Planner, Saved trips, Notifications, Budget review, Travel options and Account. The remaining itinerary hotel booking button is removed; map access remains. Backend booking actions remain disabled.

Optional Cloudinary integration would need a cloud name and an approved delivery/upload strategy for licensed assets. Authenticated uploads require an API key and API secret held only on the server. Do not proxy or upload provider hotel media without permission. See [Cloudinary image transformations](https://cloudinary.com/documentation/image_transformations) and [Google Maps URL parameters](https://developers.google.com/maps/documentation/urls/get-started).
