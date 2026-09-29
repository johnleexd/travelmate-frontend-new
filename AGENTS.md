<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# TravelMate repository guidance

Read `../MASTERPROMPT.md` before analysis or changes. It is the authoritative
product specification; this file does not define a second UI or feature contract.

Current implementation constraints:

- TravelMate is an AI-assisted travel planning system, not a generic chatbot.
- The traveler lifecycle is **Define → Generate → Understand → Refine → Save →
  Reopen** and supports validated trips from 1–14 days.
- Budget calculations are deterministic. OpenAI or Gemini may generate a structured
  itinerary, while OpenWeatherMap or Open-Meteo may supply date-matched weather.
- Crowd information is a clearly labeled calendar estimate, not live foot traffic.
- Email verification blocks login. Profile verification is separate and may place
  an authenticated account in Limited Mode.
- Payment behavior is explicitly simulated; a configured PayMongo key does not make
  it a real payment integration.
- Preserve working landing and dashboard behavior unless the owner asks for a
  scoped change. Do not restore older fixed seven-day layouts or provider-only
  assumptions.

