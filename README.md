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

Destination defaults to one editable input: **Where do you want to go?**
Results show their country, parent location and type. The small **Browse by country**
link opens a cream modal with Close, Back, a current-area breadcrumb, full-source
search at every level and pagination. Users can browse country → available
province/state/region → city/town, skipping levels when appropriate. Country and
region choices are browsing drafts; a final city or municipality confirms the
trip destination and closes the modal. Canceling preserves the confirmed destination
and any previous unfinished direct-search text. **Clear** or deleting all text
explicitly removes confirmation and dependent stay/plan state, retaining dates
and budget. Pending requests cannot restore an erased destination or reopen a
closed browser.

Accommodation is optional. The main trip planner discovers property suggestions
without room occupancy or guest nationality inputs and never requests room rates.
The Travelers field continues to set itinerary group size. Selecting a hotel stores
an unpriced planning preference with its provider identity, permitted photos and
credits, location, star classification and reported amenities. Those details remain
available after saving and reopening; prices and availability need confirmation
with the property. Provider test amounts are excluded from displayed hotel prices
and budget recommendations. Empty or failed hotel searches do not block generation.

The same provider-backed selector works worldwide. The UI follows provider scope
and hierarchy metadata instead of country/example branches. PSA PSGC independent
cities retain their official parents and geographic-association labels. IDs,
original coordinates and source paths remain in integration and saved metadata;
normal result rows show readable names and parent locations. Provider attribution
is present in the main form, search dropdown and browsing modal. Available levels,
local terminology and smaller-place coverage vary by source.

Run focused UI verification against the existing localhost:3000 app:
`node node_modules/@playwright/test/cli.js test --config playwright.destination-modal.config.ts e2e/direct-optional-destination.spec.ts`.
The browser suite uses actual imported location records with an isolated account,
controlled hotel responses, and generation stopped after production destination
validation. It makes no private database writes.

The source-backed production browser suite uses imported GeoNames/PSGC records,
an isolated account and empty/captured hotel responses. Build, start
`node node_modules/next/dist/bin/next start --port 3007`, then run
`npx playwright test --config playwright.country-browsing.config.ts
e2e/worldwide-locations.spec.ts e2e/philippine-destinations.spec.ts
e2e/destination-areas.spec.ts`. It sends the trusted HTTPS-forwarding header and
stops generation after real location validation, without private database writes.

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

Saved Trip **View itinerary** opens a read-only modal at
`/dashboard?tab=bookings&trip=<id>`, keeping Saved trips selected and the list
in place behind it. The modal shows that saved trip's destination, dates, budget,
accommodation, and generated day cards without regenerating the plan. It has no
Edit trip, View map, Record visited places, or Mark as done toolbar; trip management
remains on the saved-trip cards. Close, Escape, the backdrop, or Back to saved trips
returns to the same list position and opener. The background cannot receive focus
while the modal is open.

Day cards add `day=<number>` to show that day's activities inside the modal.
Back to itinerary removes the day and restores the modal overview's scroll and
button focus. Refreshed links and browser history retain the selected trip/day.
Review budget keeps that trip's context and returns to its modal. Existing planner
links at `/dashboard?tab=planner&trip=<id>&from=saved` retain their editable
workspace and unsaved-change guards. Neither view regenerates a saved itinerary
when opened.

Run the isolated modal and budget navigation checks with:
`node node_modules/@playwright/test/cli.js test --config playwright.saved-itinerary.config.ts`.
They exercise desktop, mobile, a 320px screen, 31-day plans, per-trip place matching,
keyboard focus, scrolling, loading failure/retry, history, refresh, and budget
round trips with controlled API responses and no database writes.

The shared overview for saved and generated plans uses cream margins, subtle sage
contours, and white rounded day cards. Its compact summary separates the entered
trip budget from recorded or estimated expenses. Unknown zero totals say **Costs
not confirmed**; existing cost values and unpriced-expense disclosures are retained.
Every scheduled activity appears in a responsive three/two/one-column grid with
its full name, recorded location, proposed time, and destination-local timezone
when recorded. Daily allowances, rest/meal blocks, and source details remain in
disclosures, with the original editing, map, and visit actions. The overview has
no duplicate activity timeline. **View day itinerary** opens that specific day;
returning restores the same trip, scroll position, and button focus.

Overview photos use centered `object-fit: contain` in consistent sage frames, so
portrait, landscape, and square images remain uncropped. Existing provider and
destination fallback rules, credits, license links, and recovery handlers remain
active. Day themes are shown only when a short theme was actually recorded;
concatenated attraction names are retained in day notes instead of a long heading.
The [2026-10-15 layout verification report](../audit/2026-10-15/itinerary-overview/REPORT.md)
documents the running-app browser checks and their controlled-response limits.

Sparse saved days reflect their recorded entries: opening the overview never
fills them or changes their plan. A daily meal/transport allowance is shown as a
budget entry; actual activities remain visible even without a photo. The
[Tokyo Day 1 diagnosis](../audit/2026-10-15/tokyo-day-one/REPORT.md) compares the
specific saved trip with its generation/version history and the rendered UI.

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

Navigation is part of Saved trips: choose **View map / Navigate** for the intended
trip. Itinerary markers, day routes, Walking/Cycling/Driving modes, manual starting
locations, opt-in live location guidance and activity management remain available.
The itinerary's destination map opens the same saved-trip map. Navigation does not
require a hotel selection. GPS sharing begins only after the user opts in; leaving
or closing navigation stops sharing and cancels pending requests. TravelMate does
not save GPS history; route endpoints are sent to the routing provider. Times are
estimates without live traffic. See the backend README for provider configuration.

The standalone GPS workspace and sidebar item have been removed. Old
`/dashboard?tab=gps`, `/gps` and `/dashboard/gps` URLs redirect to Saved trips with
an explanation. A valid `trip` ID (and optional `day`) opens that owned trip's map;
without one, the user is asked to select a saved trip. Shared Leaflet components,
route services and location utilities remain in use.

Saved trips offers **Record visited places** alongside **View map / Navigate** on
Active and Completed trips. The modal loads named saved places across all days,
keeps new places unchecked, disables already-recorded places and supports Select
all. It uses an explicit actual visit-date input, never planned itinerary dates.
Cancel/Escape/Close do not save; a confirmed API response closes the modal with
feedback. Visited places reloads from the database when opened and after refresh.
Existing photo URLs and credits are reused without new provider searches.

Recording visits does not complete the trip. Mark as done moves only the trip to
Completed, and Mark as not done preserves every visit. Manual Record a visit and
itinerary activity visit recording remain available. Batch retries skip a place
already in the user's history; the manual recorder still supports dated return visits.

## Continuous integration

`.github/workflows/ci.yml` runs lint, unit tests, and the production build, then
runs the complete Playwright suite against an ephemeral PostgreSQL 16 database.
The E2E job checks out `johnleexd/travelmate-backend-api` by default, with the
compatible backend release's immutable SHA pinned in the workflow. Override the
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
   loads destination-relevant transportation guidance, and retrieves hotel suggestions
   for the selected coordinates and dates. Hotel selection is optional; prices and
   availability remain unconfirmed. Complete the 1–31 day range,
   group budget, party, interests, preferred activities, stay preference and transportation.
   Travel style is not a form control: new and regenerated itineraries use Balanced
   behavior and pacing, including transport buffers, a meal break and available rest time.
   The budget is a limit; missing prices remain unpriced. Older saved styles and pacing
   remain readable as historical metadata but are not reused for regeneration.
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
