<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# TravelMate Master Prompt Guidelines

Treat the master prompt as the single, complete, authoritative reference for the TravelMate project.
Key Constraints:
- **System Identity**: Name is strictly `TravelMate`. It is an AI-powered travel planning, budget tracking, and itinerary management system.
- **Verification Gates**: Separate Email verification (blocks login) and Profile verification (does not block login, places in Limited Mode).
- **Core Workflow**: Traveler Input Form -> Mathematical Budget Split Algorithm -> OpenAI & OpenWeatherMap APIs mapping -> 7-Day Panel render with weather alerts.
- **PayMongo Integration**: Test Mode only. Hold/release is simulated (`PAID_HELD` -> `Released` / `FROZEN_HELD` / `REFUNDED`).
- **Landing Page Structure**: Navbar -> Hero ("AI Travel Planning Made Real") -> Problem Section -> Traveler How It Works (5 steps) -> Host How It Works (5 steps) -> Budget Engine Explainer (7-day mock panels & weather) -> Trust & Safety -> Comparison Table -> Platform Preview -> FAQ accordion -> Dual CTA -> Footer.

