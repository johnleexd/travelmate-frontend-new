# TravelMate Next.js frontend

This project contains only the TravelMate browser UI. It uses Next.js, React,
and strict TypeScript. Backend requests to `/api/*` are rewritten to the Express
service configured by `BACKEND_URL` (default `http://localhost:5000`).

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

Run the frontend from this directory in its own terminal:

```powershell
npm.cmd run dev
```

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

The E2E suite requires the backend `.env`, a reachable seeded database, and the
demo traveler account. It creates uniquely named temporary trip records and
removes them after the persistence test.

## Continuous integration

`.github/workflows/ci.yml` runs lint, unit tests, and the production build, then
runs the complete Playwright suite against an ephemeral PostgreSQL 16 database.
The E2E job checks out `johnleexd/travelmate-backend-api` beside this repository,
applies all migrations, seeds deterministic demo users/listings, starts both
services, and uploads Playwright diagnostics for seven days.

If the backend repository is private, configure a frontend repository secret named
`BACKEND_REPO_TOKEN` with fine-grained, read-only Contents access to that backend.
No Neon, email, AI, weather, Amadeus, or payment credentials are required by CI;
external-provider behavior is exercised through deterministic unavailable/mock
paths and browser interception.

See `DEPLOYMENT.md` for production environment boundaries, release ordering,
section-77 smoke coverage, and frontend rollback steps.

See `docs/ACCESSIBILITY_AUDIT.md` for verified keyboard behavior and the remaining
manual NVDA/VoiceOver sign-off checklist.

Run `npm.cmd run dev` separately from `../travelmate-backend-api` in a second
terminal. The backend must be running for authentication, planning, weather,
booking, and dashboard data to work.

## Demonstrable workflow

The traveler dashboard presents the MVP as one lifecycle rather than unrelated
tools: **Define → Generate → Understand → Refine → Save → Reopen**. Budget,
travel options, weather, and crowd context are evidence used to review the same
trip; they are not separate workflows.

1. Register as a traveler and use the development activation code.
2. Sign in, search for a destination, and explicitly choose one structured location
   suggestion. TravelMate derives the supported local currency from its country code,
   loads destination-relevant transportation guidance, and searches Amadeus hotel
   availability for the selected coordinates and dates. Complete the 1–14 day range,
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
| Authentication | Seeded traveler plus development verification code | Verified Resend sender and real-inbox delivery |
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
- Activity, meal, and local-transport prices are estimates—not guaranteed prices.
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
