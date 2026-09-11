# TravelMate Next.js frontend

This project contains only the TravelMate browser UI. It uses Next.js, React,
and strict TypeScript. Backend requests to `/api/*` are rewritten to the Express
service configured by `BACKEND_URL` (default `http://localhost:5000`).

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

Run `npm.cmd run dev` separately from `../travelmate-backend-api` in a second
terminal. The backend must be running for authentication, planning, weather,
booking, and dashboard data to work.

## Demonstrable workflow

1. Register as a traveler or owner and use the development activation code.
2. Sign in and choose a destination, 1–14 day date range, group budget, party,
   interests, travel style, activities, stay preference, and transport preference.
3. Generate a structured itinerary, review date-matched weather availability,
   estimated crowd levels, estimated activity costs, and the deterministic budget summary.
4. Save the plan. The Trips area supports view, edit/regenerate, update, duplicate,
   and delete operations backed by Neon PostgreSQL.

## Data-source honesty

- Itineraries are labeled OpenAI, Gemini, or demo fallback.
- Activity, meal, and local-transport prices are estimates—not guaranteed prices.
- Open-Meteo/OpenWeatherMap weather is live provider data, but a forecast is shown
  only when the selected dates are within the provider forecast window.
- Crowd levels are calendar-based estimates and are never labeled as live foot traffic.
- TravelMate stays are owner/database listings. Amadeus offers are labeled test or live.
- Flight comparison and real payment processing are not currently integrated.
- Email delivery and password-recovery delivery are not currently integrated; account
  activation uses a clearly identified development code.
